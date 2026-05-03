import Database from 'better-sqlite3';
import { join } from 'path';

export class DatabaseManager {
  private db: Database.Database;

  constructor() {
    const dbPath = join(process.cwd(), 'data', 'database.db');
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
  }

  // ============ AKTIFLIK LOGS ============
  addAktiflikLog(discordId: string, username: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO aktiflik_logs (discord_id, username, checked_at)
      VALUES (?, ?, ?)
    `);
    stmt.run(discordId, username, new Date().toISOString());
  }

  hasCheckedAktiflikToday(discordId: string): boolean {
    const today = new Date().toISOString().split('T')[0];
    const stmt = this.db.prepare(`
      SELECT 1 FROM aktiflik_logs 
      WHERE discord_id = ? AND DATE(checked_at) = ?
      LIMIT 1
    `);
    return !!stmt.get(discordId, today);
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
