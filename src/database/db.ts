import Database from 'better-sqlite3';
import { join } from 'path';

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = join(process.cwd(), 'data', 'database.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.ensureAktiflikSchema();
    this.ensureAktiflikRuntimeTables();
  }

  private ensureAktiflikSchema(): void {
    try {
      const info = this.db.prepare("PRAGMA table_info('aktiflik_logs')").all() as Array<any>;
      const hasCheckedDate = info.some((c) => c.name === 'checked_date');
      if (!hasCheckedDate) {
        this.db.prepare('ALTER TABLE aktiflik_logs ADD COLUMN checked_date TEXT').run();
        this.db.prepare("UPDATE aktiflik_logs SET checked_date = DATE(checked_at)").run();
        // create unique index to prevent duplicates per-day per-user
        this.db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_aktiflik_unique ON aktiflik_logs(discord_id, checked_date)').run();
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ensureAktiflikSchema error:', err);
    }
  }

  private ensureAktiflikRuntimeTables(): void {
    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS aktiflik_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        target_role_id TEXT NOT NULL,
        duration_seconds INTEGER NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        ends_at TEXT NOT NULL,
        active INTEGER DEFAULT 1
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS aktiflik_session_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        UNIQUE(session_id, discord_id)
      )
    `).run();

    this.db.prepare(`
      CREATE TABLE IF NOT EXISTS aktiflik_member_status (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        consecutive_misses INTEGER DEFAULT 0,
        total_misses INTEGER DEFAULT 0,
        last_seen_at TEXT,
        updated_at TEXT NOT NULL
      )
    `).run();

    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_aktiflik_sessions_active ON aktiflik_sessions(active)').run();
    this.db.prepare('CREATE INDEX IF NOT EXISTS idx_aktiflik_participants_session ON aktiflik_session_participants(session_id)').run();
  }

  // ============ AKTIFLIK LOGS ============
  addAktiflikLog(discordId: string, username: string): boolean {
    // Use checked_date column (YYYY-MM-DD) to enforce uniqueness atomically
    const now = new Date().toISOString();
    const date = now.split('T')[0];
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO aktiflik_logs (discord_id, username, checked_at, checked_date)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(discordId, username, now, date);
      return result.changes > 0;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('addAktiflikLog error:', err);
      return false;
    }
  }

  hasCheckedAktiflikToday(discordId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    // Prefer checked_date column if exists
    try {
      const info = this.db.prepare("PRAGMA table_info('aktiflik_logs')").all() as Array<any>;
      const hasCheckedDate = info.some((c) => c.name === 'checked_date');
      if (hasCheckedDate) {
        const stmt = this.db.prepare('SELECT 1 FROM aktiflik_logs WHERE discord_id = ? AND checked_date = ? LIMIT 1');
        return !!stmt.get(discordId, today);
      }
    } catch (err) {
      // ignore and fallback
    }
    const today2 = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT 1 FROM aktiflik_logs 
      WHERE discord_id = ? AND DATE(checked_at) = ?
      LIMIT 1
    `);
    return !!stmt.get(discordId, today2);
  }

  // ============ AKTIFLIK SESSIONS ============
  createAktiflikSession(
    messageId: string,
    channelId: string,
    targetRoleId: string,
    durationSeconds: number,
    createdBy: string
  ): number {
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);
    const stmt = this.db.prepare(`
      INSERT INTO aktiflik_sessions (message_id, channel_id, target_role_id, duration_seconds, created_by, created_at, ends_at, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(
      messageId,
      channelId,
      targetRoleId,
      durationSeconds,
      createdBy,
      now.toISOString(),
      endsAt.toISOString()
    );
    return result.lastInsertRowid as number;
  }

  getAktiflikSessionByMessageId(messageId: string): {
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: string;
    ends_at: string;
    active: number;
  } | undefined {
    const stmt = this.db.prepare(`
      SELECT id, message_id, channel_id, target_role_id, duration_seconds, created_by, created_at, ends_at, active
      FROM aktiflik_sessions
      WHERE message_id = ?
      LIMIT 1
    `);
    return stmt.get(messageId) as any;
  }

  addAktiflikSessionParticipant(sessionId: number, discordId: string, username: string): boolean {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO aktiflik_session_participants (session_id, discord_id, username, joined_at)
      VALUES (?, ?, ?, ?)
    `);
    const result = stmt.run(sessionId, discordId, username, new Date().toISOString());
    return result.changes > 0;
  }

  hasJoinedAktiflikSession(sessionId: number, discordId: string): boolean {
    const stmt = this.db.prepare('SELECT 1 FROM aktiflik_session_participants WHERE session_id = ? AND discord_id = ? LIMIT 1');
    return !!stmt.get(sessionId, discordId);
  }

  getAktiflikSessionParticipants(sessionId: number): Array<{ id: string; username: string; joined_at: string }> {
    const stmt = this.db.prepare(`
      SELECT discord_id as id, username, joined_at
      FROM aktiflik_session_participants
      WHERE session_id = ?
      ORDER BY joined_at ASC
    `);
    return stmt.all(sessionId) as Array<any>;
  }

  closeAktiflikSession(sessionId: number): void {
    const stmt = this.db.prepare('UPDATE aktiflik_sessions SET active = 0 WHERE id = ?');
    stmt.run(sessionId);
  }

  markAktiflikJoined(discordId: string, username: string): void {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO aktiflik_member_status (discord_id, username, consecutive_misses, total_misses, last_seen_at, updated_at)
      VALUES (?, ?, 0, 0, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        consecutive_misses = 0,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `);
    stmt.run(discordId, username, now, now);
  }

  incrementAktiflikMiss(discordId: string, username: string): { consecutive_misses: number; total_misses: number } {
    const existing = this.db.prepare(`
      SELECT discord_id, username, consecutive_misses, total_misses
      FROM aktiflik_member_status
      WHERE discord_id = ?
      LIMIT 1
    `).get(discordId) as any;

    const now = new Date().toISOString();
    if (!existing) {
      this.db.prepare(`
        INSERT INTO aktiflik_member_status (discord_id, username, consecutive_misses, total_misses, last_seen_at, updated_at)
        VALUES (?, ?, 1, 1, NULL, ?)
      `).run(discordId, username, now);
      return { consecutive_misses: 1, total_misses: 1 };
    }

    const consecutive = Number(existing.consecutive_misses || 0) + 1;
    const total = Number(existing.total_misses || 0) + 1;
    this.db.prepare(`
      UPDATE aktiflik_member_status
      SET username = ?, consecutive_misses = ?, total_misses = ?, updated_at = ?
      WHERE discord_id = ?
    `).run(username, consecutive, total, now, discordId);

    return { consecutive_misses: consecutive, total_misses: total };
  }

  // ============ BANS ============
  addBan(discordId: string, username: string, reason: string, bannedBy: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO bans (discord_id, username, reason, banned_by, banned_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    stmt.run(discordId, username, reason, bannedBy, new Date().toISOString());
  }

  isBanned(discordId: string): boolean {
    const stmt = this.db.prepare(`
      SELECT 1 FROM bans WHERE discord_id = ? AND active = 1 LIMIT 1
    `);
    return !!stmt.get(discordId);
  }

  getActiveBans(): Array<{
    id: number;
    discord_id: string;
    username: string;
    reason: string;
    banned_by: string;
    banned_at: string;
  }> {
    const stmt = this.db.prepare(`
      SELECT id, discord_id, username, reason, banned_by, banned_at
      FROM bans WHERE active = 1
      ORDER BY banned_at DESC
    `);
    return stmt.all() as Array<any>;
  }

  unbanUser(banId: number): void {
    const stmt = this.db.prepare('UPDATE bans SET active = 0 WHERE id = ?');
    stmt.run(banId);
  }

  getBanById(banId: number): { id: number; discord_id: string; username: string; reason: string; banned_by: string; banned_at: string } | undefined {
    const stmt = this.db.prepare('SELECT * FROM bans WHERE id = ? AND active = 1');
    return stmt.get(banId) as any;
  }

  // ============ FARM LOGS ============
  addFarmLog(discordId: string, username: string, amount: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO farm_logs (discord_id, username, amount, given_at)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(discordId, username, amount, new Date().toISOString());
  }

  getFarmLeaderboard(): Array<{ discord_id: string; username: string; total_amount: number }> {
    const stmt = this.db.prepare(`
      SELECT discord_id, username, SUM(amount) as total_amount
      FROM farm_logs
      GROUP BY discord_id
      ORDER BY total_amount DESC
    `);
    return stmt.all() as Array<any>;
  }

  // ============ INGAME SESSIONS ============
  createIngameSession(messageId: string, channelId: string, createdBy: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO ingame_sessions (message_id, channel_id, participants, created_by, created_at, active)
      VALUES (?, ?, ?, ?, ?, 1)
    `);
    const result = stmt.run(messageId, channelId, JSON.stringify([]), createdBy, new Date().toISOString());
    return result.lastInsertRowid as number;
  }

  getActiveIngameSession(): { id: number; message_id: string; channel_id: string; participants: string; created_by: string; created_at: string } | undefined {
    const stmt = this.db.prepare(`
      SELECT id, message_id, channel_id, participants, created_by, created_at
      FROM ingame_sessions WHERE active = 1
      ORDER BY created_at DESC LIMIT 1
    `);
    return stmt.get() as any;
  }

  addIngameSessionParticipant(sessionId: number, discordId: string, username: string): void {
    const session = this.db.prepare('SELECT participants FROM ingame_sessions WHERE id = ?').get(sessionId) as any;
    if (session) {
      const participants = JSON.parse(session.participants) as Array<{ id: string; username: string }>;
      if (!participants.find((p) => p.id === discordId)) {
        participants.push({ id: discordId, username });
        const stmt = this.db.prepare('UPDATE ingame_sessions SET participants = ? WHERE id = ?');
        stmt.run(JSON.stringify(participants), sessionId);
      }
    }
  }

  removeIngameSessionParticipant(sessionId: number, discordId: string): void {
    const session = this.db.prepare('SELECT participants FROM ingame_sessions WHERE id = ?').get(sessionId) as any;
    if (session) {
      const participants = JSON.parse(session.participants) as Array<{ id: string; username: string }>;
      const filtered = participants.filter((p) => p.id !== discordId);
      const stmt = this.db.prepare('UPDATE ingame_sessions SET participants = ? WHERE id = ?');
      stmt.run(JSON.stringify(filtered), sessionId);
    }
  }

  getIngameSessionParticipants(sessionId: number): Array<{ id: string; username: string }> {
    const session = this.db.prepare('SELECT participants FROM ingame_sessions WHERE id = ?').get(sessionId) as any;
    if (session) {
      return JSON.parse(session.participants) as Array<{ id: string; username: string }>;
    }
    return [];
  }

  closeIngameSession(sessionId: number): void {
    const stmt = this.db.prepare('UPDATE ingame_sessions SET active = 0 WHERE id = ?');
    stmt.run(sessionId);
  }

  // ============ BOT LOGS ============
  addBotLog(action: string, userId: string, username: string, details?: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO bot_logs (action, user_id, username, details, logged_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(action, userId, username, details || null, new Date().toISOString());
  }

  close(): void {
    this.db.close();
  }
}

// Export singleton instance
export const db = new DatabaseManager();
