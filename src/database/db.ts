import { dirname, resolve } from 'path';
import { existsSync, mkdirSync } from 'fs';

type SqliteRunResult = { changes: number; lastID: number };

const sqlite3 = require('sqlite3').verbose();

export class DatabaseManager {
  private db: any;

  private ready: Promise<void>;

  constructor() {
    const dbPath = resolve(process.cwd(), 'data', 'database.sqlite');
    const dbDir = dirname(dbPath);

    try {
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Database directory create error:', error);
    }

    this.db = new sqlite3.Database(dbPath, (error: Error | null) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Database open error:', error);
      }
    });

    this.ready = this.initialize().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Database initialization error:', error);
      throw error;
    });
  }

  private async initialize(): Promise<void> {
    await this.exec('PRAGMA journal_mode = WAL');
    await this.ensureCoreTables();
    await this.ensureAktiflikSchema();
    await this.ensureAktiflikRuntimeTables();
  }

  private run(sql: string, params: unknown[] = []): Promise<SqliteRunResult> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function sqliteRunCallback(this: SqliteRunResult, err: Error | null) {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          changes: Number((this as any).changes ?? 0),
          lastID: Number((this as any).lastID ?? 0),
        });
      });
    });
  }

  private get<T>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err: Error | null, row: T | undefined) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(row);
      });
    });
  }

  private all<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err: Error | null, rows: T[]) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(rows);
      });
    });
  }

  private exec(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, (err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }

  private async ensureCoreTables(): Promise<void> {
    await this.exec(`
      CREATE TABLE IF NOT EXISTS aktiflik_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        checked_at TEXT NOT NULL,
        checked_date TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS bans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        reason TEXT NOT NULL,
        banned_by TEXT NOT NULL,
        banned_at TEXT NOT NULL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS farm_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        amount INTEGER NOT NULL,
        given_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingame_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        participants TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL,
        active INTEGER DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS bot_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action TEXT NOT NULL,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        details TEXT,
        logged_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingame_q_misses (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        miss_count INTEGER DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ingame_session_q_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        UNIQUE(session_id, discord_id)
      );
    `);
  }

  private async ensureAktiflikSchema(): Promise<void> {
    try {
      const info = await this.all<{ name: string }>("PRAGMA table_info('aktiflik_logs')");
      const hasCheckedDate = info.some((column) => column.name === 'checked_date');
      if (!hasCheckedDate) {
        await this.exec('ALTER TABLE aktiflik_logs ADD COLUMN checked_date TEXT');
        await this.exec('UPDATE aktiflik_logs SET checked_date = DATE(checked_at)');
      }

      await this.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_aktiflik_unique ON aktiflik_logs(discord_id, checked_date)');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('ensureAktiflikSchema error:', err);
    }
  }

  private async ensureAktiflikRuntimeTables(): Promise<void> {
    await this.exec(`
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
      );

      CREATE TABLE IF NOT EXISTS aktiflik_session_participants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        discord_id TEXT NOT NULL,
        username TEXT NOT NULL,
        joined_at TEXT NOT NULL,
        UNIQUE(session_id, discord_id)
      );

      CREATE TABLE IF NOT EXISTS aktiflik_member_status (
        discord_id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        consecutive_misses INTEGER DEFAULT 0,
        total_misses INTEGER DEFAULT 0,
        last_seen_at TEXT,
        updated_at TEXT NOT NULL
      );
    `);

    await this.exec('CREATE INDEX IF NOT EXISTS idx_aktiflik_sessions_active ON aktiflik_sessions(active)');
    await this.exec('CREATE INDEX IF NOT EXISTS idx_aktiflik_participants_session ON aktiflik_session_participants(session_id)');
  }

  // ============ AKTIFLIK LOGS ============
  async addAktiflikLog(discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const now = new Date().toISOString();
    const date = now.split('T')[0];

    try {
      const result = await this.run(
        'INSERT OR IGNORE INTO aktiflik_logs (discord_id, username, checked_at, checked_date) VALUES (?, ?, ?, ?)',
        [discordId, username, now, date]
      );
      return result.changes > 0;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('addAktiflikLog error:', err);
      return false;
    }
  }

  async hasCheckedAktiflikToday(discordId: string): Promise<boolean> {
    await this.ready;
    const today = new Date().toISOString().split('T')[0];

    try {
      const info = await this.all<{ name: string }>("PRAGMA table_info('aktiflik_logs')");
      const hasCheckedDate = info.some((column) => column.name === 'checked_date');
      if (hasCheckedDate) {
        const row = await this.get('SELECT 1 FROM aktiflik_logs WHERE discord_id = ? AND checked_date = ? LIMIT 1', [discordId, today]);
        return !!row;
      }
    } catch {
      // ignore and fallback
    }

    const row = await this.get('SELECT 1 FROM aktiflik_logs WHERE discord_id = ? AND DATE(checked_at) = ? LIMIT 1', [discordId, today]);
    return !!row;
  }

  // ============ AKTIFLIK SESSIONS ============
  async createAktiflikSession(
    messageId: string,
    channelId: string,
    targetRoleId: string,
    durationSeconds: number,
    createdBy: string
  ): Promise<number> {
    await this.ready;
    const now = new Date();
    const endsAt = new Date(now.getTime() + durationSeconds * 1000);
    const result = await this.run(
      'INSERT INTO aktiflik_sessions (message_id, channel_id, target_role_id, duration_seconds, created_by, created_at, ends_at, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)',
      [messageId, channelId, targetRoleId, durationSeconds, createdBy, now.toISOString(), endsAt.toISOString()]
    );
    return result.lastID;
  }

  async getAktiflikSessionByMessageId(messageId: string): Promise<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: string;
    ends_at: string;
    active: number;
  } | undefined> {
    await this.ready;
    return this.get('SELECT id, message_id, channel_id, target_role_id, duration_seconds, created_by, created_at, ends_at, active FROM aktiflik_sessions WHERE message_id = ? LIMIT 1', [messageId]) as Promise<any>;
  }

  async getActiveAktiflikSessions(): Promise<Array<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: string;
    ends_at: string;
    active: number;
  }>> {
    await this.ready;
    return this.all('SELECT id, message_id, channel_id, target_role_id, duration_seconds, created_by, created_at, ends_at, active FROM aktiflik_sessions WHERE active = 1 ORDER BY ends_at ASC');
  }

  async addAktiflikSessionParticipant(sessionId: number, discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const result = await this.run(
      'INSERT OR IGNORE INTO aktiflik_session_participants (session_id, discord_id, username, joined_at) VALUES (?, ?, ?, ?)',
      [sessionId, discordId, username, new Date().toISOString()]
    );
    return result.changes > 0;
  }

  async hasJoinedAktiflikSession(sessionId: number, discordId: string): Promise<boolean> {
    await this.ready;
    const row = await this.get('SELECT 1 FROM aktiflik_session_participants WHERE session_id = ? AND discord_id = ? LIMIT 1', [sessionId, discordId]);
    return !!row;
  }

  async getAktiflikSessionParticipants(sessionId: number): Promise<Array<{ id: string; username: string; joined_at: string }>> {
    await this.ready;
    return this.all('SELECT discord_id as id, username, joined_at FROM aktiflik_session_participants WHERE session_id = ? ORDER BY joined_at ASC', [sessionId]);
  }

  async closeAktiflikSession(sessionId: number): Promise<void> {
    await this.ready;
    await this.run('UPDATE aktiflik_sessions SET active = 0 WHERE id = ?', [sessionId]);
  }

  async markAktiflikJoined(discordId: string, username: string): Promise<void> {
    await this.ready;
    const now = new Date().toISOString();
    await this.run(
      `
      INSERT INTO aktiflik_member_status (discord_id, username, consecutive_misses, total_misses, last_seen_at, updated_at)
      VALUES (?, ?, 0, 0, ?, ?)
      ON CONFLICT(discord_id) DO UPDATE SET
        username = excluded.username,
        consecutive_misses = 0,
        last_seen_at = excluded.last_seen_at,
        updated_at = excluded.updated_at
    `,
      [discordId, username, now, now]
    );
  }

  async incrementAktiflikMiss(discordId: string, username: string): Promise<{ consecutive_misses: number; total_misses: number }> {
    await this.ready;
    const existing = await this.get<{ consecutive_misses: number; total_misses: number }>(
      'SELECT consecutive_misses, total_misses FROM aktiflik_member_status WHERE discord_id = ? LIMIT 1',
      [discordId]
    );

    const now = new Date().toISOString();
    if (!existing) {
      await this.run(
        'INSERT INTO aktiflik_member_status (discord_id, username, consecutive_misses, total_misses, last_seen_at, updated_at) VALUES (?, ?, 1, 1, NULL, ?)',
        [discordId, username, now]
      );
      return { consecutive_misses: 1, total_misses: 1 };
    }

    const consecutive = Number(existing.consecutive_misses || 0) + 1;
    const total = Number(existing.total_misses || 0) + 1;
    await this.run(
      'UPDATE aktiflik_member_status SET username = ?, consecutive_misses = ?, total_misses = ?, updated_at = ? WHERE discord_id = ?',
      [username, consecutive, total, now, discordId]
    );

    return { consecutive_misses: consecutive, total_misses: total };
  }

  // ============ BANS ============
  async addBan(discordId: string, username: string, reason: string, bannedBy: string): Promise<void> {
    await this.ready;
    await this.run('INSERT INTO bans (discord_id, username, reason, banned_by, banned_at, active) VALUES (?, ?, ?, ?, ?, 1)', [discordId, username, reason, bannedBy, new Date().toISOString()]);
  }

  async isBanned(discordId: string): Promise<boolean> {
    await this.ready;
    const row = await this.get('SELECT 1 FROM bans WHERE discord_id = ? AND active = 1 LIMIT 1', [discordId]);
    return !!row;
  }

  async getActiveBans(): Promise<Array<{
    id: number;
    discord_id: string;
    username: string;
    reason: string;
    banned_by: string;
    banned_at: string;
  }>> {
    await this.ready;
    return this.all('SELECT id, discord_id, username, reason, banned_by, banned_at FROM bans WHERE active = 1 ORDER BY banned_at DESC');
  }

  async unbanUser(banId: number): Promise<void> {
    await this.ready;
    await this.run('UPDATE bans SET active = 0 WHERE id = ?', [banId]);
  }

  async getBanById(banId: number): Promise<{ id: number; discord_id: string; username: string; reason: string; banned_by: string; banned_at: string } | undefined> {
    await this.ready;
    return this.get('SELECT * FROM bans WHERE id = ? AND active = 1', [banId]) as Promise<any>;
  }

  // ============ FARM LOGS ============
  async addFarmLog(discordId: string, username: string, amount: number): Promise<void> {
    await this.ready;
    await this.run('INSERT INTO farm_logs (discord_id, username, amount, given_at) VALUES (?, ?, ?, ?)', [discordId, username, amount, new Date().toISOString()]);
  }

  async getFarmLeaderboard(): Promise<Array<{ discord_id: string; username: string; total_amount: number }>> {
    await this.ready;
    return this.all('SELECT discord_id, username, SUM(amount) as total_amount FROM farm_logs GROUP BY discord_id ORDER BY total_amount DESC');
  }

  // ============ INGAME SESSIONS ============
  async createIngameSession(messageId: string, channelId: string, createdBy: string): Promise<number> {
    await this.ready;
    const result = await this.run('INSERT INTO ingame_sessions (message_id, channel_id, participants, created_by, created_at, active) VALUES (?, ?, ?, ?, ?, 1)', [messageId, channelId, JSON.stringify([]), createdBy, new Date().toISOString()]);
    return result.lastID;
  }

  async getActiveIngameSession(): Promise<{ id: number; message_id: string; channel_id: string; participants: string; created_by: string; created_at: string } | undefined> {
    await this.ready;
    return this.get('SELECT id, message_id, channel_id, participants, created_by, created_at FROM ingame_sessions WHERE active = 1 ORDER BY created_at DESC LIMIT 1') as Promise<any>;
  }

  async getLatestIngameSession(): Promise<{ id: number; message_id: string; channel_id: string; participants: string; created_by: string; created_at: string; active: number } | undefined> {
    await this.ready;
    return this.get('SELECT id, message_id, channel_id, participants, created_by, created_at, active FROM ingame_sessions ORDER BY created_at DESC LIMIT 1') as Promise<any>;
  }

  async addIngameSessionParticipant(sessionId: number, discordId: string, username: string): Promise<void> {
    await this.ready;
    const session = await this.get<{ participants: string }>('SELECT participants FROM ingame_sessions WHERE id = ?', [sessionId]);
    if (session) {
      const participants = JSON.parse(session.participants) as Array<{ id: string; username: string }>;
      if (!participants.find((p) => p.id === discordId)) {
        participants.push({ id: discordId, username });
        await this.run('UPDATE ingame_sessions SET participants = ? WHERE id = ?', [JSON.stringify(participants), sessionId]);
      }
    }
  }

  async removeIngameSessionParticipant(sessionId: number, discordId: string): Promise<void> {
    await this.ready;
    const session = await this.get<{ participants: string }>('SELECT participants FROM ingame_sessions WHERE id = ?', [sessionId]);
    if (session) {
      const participants = JSON.parse(session.participants) as Array<{ id: string; username: string }>;
      const filtered = participants.filter((p) => p.id !== discordId);
      await this.run('UPDATE ingame_sessions SET participants = ? WHERE id = ?', [JSON.stringify(filtered), sessionId]);
    }
  }

  async getIngameSessionParticipants(sessionId: number): Promise<Array<{ id: string; username: string }>> {
    await this.ready;
    const session = await this.get<{ participants: string }>('SELECT participants FROM ingame_sessions WHERE id = ?', [sessionId]);
    if (session) {
      return JSON.parse(session.participants) as Array<{ id: string; username: string }>;
    }

    return [];
  }

  async closeIngameSession(sessionId: number): Promise<void> {
    await this.ready;
    await this.run('UPDATE ingame_sessions SET active = 0 WHERE id = ?', [sessionId]);
    await this.run('DELETE FROM ingame_session_q_participants WHERE session_id = ?', [sessionId]);
  }

  // ============ INGAME Q TRACKING ============
  async addIngameSessionQParticipant(sessionId: number, discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const result = await this.run(
      'INSERT OR IGNORE INTO ingame_session_q_participants (session_id, discord_id, username, joined_at) VALUES (?, ?, ?, ?)',
      [sessionId, discordId, username, new Date().toISOString()]
    );
    return result.changes > 0;
  }

  async getIngameSessionQParticipants(sessionId: number): Promise<Array<{ id: string; username: string; joined_at: string }>> {
    await this.ready;
    return this.all(
      'SELECT discord_id as id, username, joined_at FROM ingame_session_q_participants WHERE session_id = ? ORDER BY joined_at ASC',
      [sessionId]
    );
  }

  async incrementIngameQMiss(discordId: string, username: string): Promise<{ miss_count: number }> {
    await this.ready;
    const existing = await this.get<{ miss_count: number }>('SELECT miss_count FROM ingame_q_misses WHERE discord_id = ? LIMIT 1', [discordId]);
    const now = new Date().toISOString();

    if (!existing) {
      await this.run(
        'INSERT INTO ingame_q_misses (discord_id, username, miss_count, updated_at) VALUES (?, ?, 1, ?)',
        [discordId, username, now]
      );
      return { miss_count: 1 };
    }

    const missCount = Number(existing.miss_count || 0) + 1;
    await this.run(
      'UPDATE ingame_q_misses SET username = ?, miss_count = ?, updated_at = ? WHERE discord_id = ?',
      [username, missCount, now, discordId]
    );

    return { miss_count: missCount };
  }

  async resetIngameQMiss(discordId: string): Promise<void> {
    await this.ready;
    await this.run('DELETE FROM ingame_q_misses WHERE discord_id = ?', [discordId]);
  }

  async getIngameQWaitingCount(): Promise<number> {
    await this.ready;
    const row = await this.get<{ count: number }>('SELECT COUNT(*) as count FROM ingame_q_misses WHERE miss_count > 0');
    return Number(row?.count || 0);
  }

  // ============ BOT LOGS ============
  async addBotLog(action: string, userId: string, username: string, details?: string): Promise<void> {
    await this.ready;
    await this.run('INSERT INTO bot_logs (action, user_id, username, details, logged_at) VALUES (?, ?, ?, ?, ?)', [action, userId, username, details || null, new Date().toISOString()]);
  }

  async close(): Promise<void> {
    await this.ready;
    await new Promise<void>((resolve, reject) => {
      this.db.close((err: Error | null) => {
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    });
  }
}

// Export singleton instance
export const db = new DatabaseManager();
