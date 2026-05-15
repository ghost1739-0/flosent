import { connectMongo, disconnectMongo } from './mongo';
import {
  getNextSequence,
  AktiflikLogModel,
  AktiflikMemberStatusModel,
  AktiflikSessionModel,
  AktiflikSessionParticipantModel,
  BanModel,
  BotLogModel,
  FarmLogModel,
  IngameQMissModel,
  IngameSessionModel,
  IngameSessionQParticipantModel,
} from './models';

export class DatabaseManager {
  private ready: Promise<void>;

  constructor() {
    this.ready = this.initialize().catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Database initialization error:', error);
      throw error;
    });
  }

  private async initialize(): Promise<void> {
    await connectMongo();

    await Promise.all([
      AktiflikLogModel.init(),
      BanModel.init(),
      FarmLogModel.init(),
      IngameSessionModel.init(),
      BotLogModel.init(),
      IngameQMissModel.init(),
      IngameSessionQParticipantModel.init(),
      AktiflikSessionModel.init(),
      AktiflikSessionParticipantModel.init(),
      AktiflikMemberStatusModel.init(),
    ]);
  }

  private async nextId(collectionName: string): Promise<number> {
    await this.ready;
    return getNextSequence(collectionName);
  }

  async addAktiflikLog(discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const now = new Date();
    const checkedDate = now.toISOString().split('T')[0];

    const result = await AktiflikLogModel.updateOne(
      { discordId, checkedDate },
      {
        $setOnInsert: {
          id: await this.nextId('aktiflik_logs'),
          discordId,
          username,
          checkedAt: now,
          checkedDate,
        },
      },
      { upsert: true }
    );

    return Number(result.upsertedCount ?? 0) > 0;
  }

  async hasCheckedAktiflikToday(discordId: string): Promise<boolean> {
    await this.ready;
    const today = new Date().toISOString().split('T')[0];
    return !!(await AktiflikLogModel.exists({ discordId, checkedDate: today }));
  }

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
    const id = await this.nextId('aktiflik_sessions');

    await AktiflikSessionModel.create({
      id,
      messageId,
      channelId,
      targetRoleId,
      durationSeconds,
      createdBy,
      createdAt: now,
      endsAt,
      active: true,
    });

    return id;
  }

  async getAktiflikSessionByMessageId(messageId: string): Promise<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: Date;
    ends_at: Date;
    active: number;
  } | undefined> {
    await this.ready;
    const session = await AktiflikSessionModel.findOne({ messageId }).lean();
    if (!session) {
      return undefined;
    }

    return {
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      target_role_id: session.targetRoleId,
      duration_seconds: session.durationSeconds,
      created_by: session.createdBy,
      created_at: session.createdAt,
      ends_at: session.endsAt,
      active: session.active ? 1 : 0,
    };
  }

  async getActiveAktiflikSessions(): Promise<Array<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: Date;
    ends_at: Date;
    active: number;
  }>> {
    await this.ready;
    const sessions = await AktiflikSessionModel.find({ active: true }).sort({ endsAt: 1 }).lean();
    return sessions.map((session) => ({
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      target_role_id: session.targetRoleId,
      duration_seconds: session.durationSeconds,
      created_by: session.createdBy,
      created_at: session.createdAt,
      ends_at: session.endsAt,
      active: session.active ? 1 : 0,
    }));
  }

  async getLatestAktiflikSession(): Promise<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: Date;
    ends_at: Date;
    active: number;
  } | undefined> {
    await this.ready;
    const session = await AktiflikSessionModel.findOne().sort({ createdAt: -1 }).lean();
    if (!session) {
      return undefined;
    }

    return {
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      target_role_id: session.targetRoleId,
      duration_seconds: session.durationSeconds,
      created_by: session.createdBy,
      created_at: session.createdAt,
      ends_at: session.endsAt,
      active: session.active ? 1 : 0,
    };
  }

  async getAktiflikSessionById(sessionId: number): Promise<{
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    duration_seconds: number;
    created_by: string;
    created_at: Date;
    ends_at: Date;
    active: number;
  } | undefined> {
    await this.ready;
    const session = await AktiflikSessionModel.findOne({ id: sessionId }).lean();
    if (!session) {
      return undefined;
    }

    return {
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      target_role_id: session.targetRoleId,
      duration_seconds: session.durationSeconds,
      created_by: session.createdBy,
      created_at: session.createdAt,
      ends_at: session.endsAt,
      active: session.active ? 1 : 0,
    };
  }

  async addAktiflikSessionParticipant(sessionId: number, discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const id = await this.nextId('aktiflik_session_participants');
    const result = await AktiflikSessionParticipantModel.updateOne(
      { sessionId, discordId },
      {
        $setOnInsert: {
          id,
          sessionId,
          discordId,
          username,
          joinedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Number(result.upsertedCount ?? 0) > 0;
  }

  async hasJoinedAktiflikSession(sessionId: number, discordId: string): Promise<boolean> {
    await this.ready;
    return !!(await AktiflikSessionParticipantModel.exists({ sessionId, discordId }));
  }

  async getAktiflikSessionParticipants(sessionId: number): Promise<Array<{ id: string; username: string; joined_at: Date }>> {
    await this.ready;
    const participants = await AktiflikSessionParticipantModel.find({ sessionId }).sort({ joinedAt: 1 }).lean();
    return participants.map((participant) => ({
      id: participant.discordId,
      username: participant.username,
      joined_at: participant.joinedAt,
    }));
  }

  async closeAktiflikSession(sessionId: number): Promise<boolean> {
    await this.ready;
    const result = await AktiflikSessionModel.updateOne({ id: sessionId, active: true }, { $set: { active: false } });
    // Return true if we actually changed the document from active:true -> active:false
    // Support both modern and older mongoose result shapes
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const modified = Number((result as any).modifiedCount ?? (result as any).nModified ?? 0);
    return modified > 0;
  }

  async markAktiflikJoined(discordId: string, username: string): Promise<void> {
    await this.ready;
    const now = new Date();
    await AktiflikMemberStatusModel.updateOne(
      { discordId },
      {
        $set: {
          username,
          consecutiveMisses: 0,
          lastSeenAt: now,
          updatedAt: now,
        },
        $setOnInsert: { discordId },
      },
      { upsert: true }
    );
  }

  async incrementAktiflikMiss(discordId: string, username: string): Promise<{ consecutive_misses: number; total_misses: number }> {
    await this.ready;
    const result = await AktiflikMemberStatusModel.findOneAndUpdate(
      { discordId },
      {
        $set: {
          username,
          updatedAt: new Date(),
          lastSeenAt: null,
        },
        $setOnInsert: { discordId },
        $inc: { consecutiveMisses: 1, totalMisses: 1 },
      },
      { upsert: true, new: true }
    ).lean();

    return {
      consecutive_misses: Number(result?.consecutiveMisses ?? 0),
      total_misses: Number(result?.totalMisses ?? 0),
    };
  }

  async addBan(discordId: string, username: string, reason: string, banCode: string, bannedBy: string): Promise<void> {
    await this.ready;
    const now = new Date();
    const existingBan = await BanModel.findOne({ discordId, active: true }).lean();

    if (existingBan) {
      await BanModel.updateOne(
        { id: existingBan.id },
        {
          $set: {
            username,
            reason,
            banCode,
            bannedBy,
            bannedAt: now,
            active: true,
          },
        }
      );
      return;
    }

    const id = await this.nextId('bans');
    await BanModel.create({
      id,
      discordId,
      username,
      reason,
      banCode,
      bannedBy,
      bannedAt: now,
      active: true,
    });
  }

  async isBanned(discordId: string): Promise<boolean> {
    await this.ready;
    return !!(await BanModel.exists({ discordId, active: true }));
  }

  async getActiveBans(): Promise<Array<{
    id: number;
    discord_id: string;
    username: string;
    reason: string;
    ban_code: string;
    banned_by: string;
    banned_at: Date;
  }>> {
    await this.ready;
    const bans = await BanModel.find({ active: true }).sort({ bannedAt: -1 }).lean();
    return bans.map((ban) => ({
      id: ban.id,
      discord_id: ban.discordId,
      username: ban.username,
      reason: ban.reason,
      ban_code: ban.banCode,
      banned_by: ban.bannedBy,
      banned_at: ban.bannedAt,
    }));
  }

  async unbanUser(banId: number): Promise<void> {
    await this.ready;
    await BanModel.updateOne({ id: banId }, { $set: { active: false } });
  }

  async getBanById(banId: number): Promise<{ id: number; discord_id: string; username: string; reason: string; ban_code: string; banned_by: string; banned_at: Date } | undefined> {
    await this.ready;
    const ban = await BanModel.findOne({ id: banId, active: true }).lean();
    if (!ban) {
      return undefined;
    }

    return {
      id: ban.id,
      discord_id: ban.discordId,
      username: ban.username,
      reason: ban.reason,
      ban_code: ban.banCode,
      banned_by: ban.bannedBy,
      banned_at: ban.bannedAt,
    };
  }

  async addFarmLog(discordId: string, username: string, amount: number): Promise<void> {
    await this.ready;
    const id = await this.nextId('farm_logs');
    await FarmLogModel.create({
      id,
      discordId,
      username,
      amount,
      givenAt: new Date(),
    });
  }

  async getFarmLeaderboard(): Promise<Array<{ discord_id: string; username: string; total_amount: number }>> {
    await this.ready;
    const rows = await FarmLogModel.aggregate([
      {
        $group: {
          _id: { discordId: '$discordId', username: '$username' },
          total_amount: { $sum: '$amount' },
        },
      },
      {
        $sort: { total_amount: -1 },
      },
    ]);

    return rows.map((row) => ({
      discord_id: row._id.discordId,
      username: row._id.username,
      total_amount: Number(row.total_amount ?? 0),
    }));
  }

  async createIngameSession(messageId: string, channelId: string, createdBy: string): Promise<number> {
    await this.ready;
    const id = await this.nextId('ingame_sessions');
    await IngameSessionModel.create({
      id,
      messageId,
      channelId,
      participants: [],
      lastQAnnouncementMessageId: null,
      createdBy,
      createdAt: new Date(),
      active: true,
    });
    return id;
  }

  async getActiveIngameSession(): Promise<{ id: number; message_id: string; channel_id: string; participants: string; last_q_announcement_message_id: string | null; created_by: string; created_at: Date } | undefined> {
    await this.ready;
    const session = await IngameSessionModel.findOne({ active: true }).sort({ createdAt: -1 }).lean();
    if (!session) {
      return undefined;
    }

    return {
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      participants: JSON.stringify((session.participants ?? []).map((participant: any) => ({
        id: participant.discordId,
        username: participant.username,
      }))),
      last_q_announcement_message_id: session.lastQAnnouncementMessageId ?? null,
      created_by: session.createdBy,
      created_at: session.createdAt,
    };
  }

  async getLatestIngameSession(): Promise<{ id: number; message_id: string; channel_id: string; participants: string; last_q_announcement_message_id: string | null; created_by: string; created_at: Date; active: number } | undefined> {
    await this.ready;
    const session = await IngameSessionModel.findOne().sort({ createdAt: -1 }).lean();
    if (!session) {
      return undefined;
    }

    return {
      id: session.id,
      message_id: session.messageId,
      channel_id: session.channelId,
      participants: JSON.stringify((session.participants ?? []).map((participant: any) => ({
        id: participant.discordId,
        username: participant.username,
      }))),
      last_q_announcement_message_id: session.lastQAnnouncementMessageId ?? null,
      created_by: session.createdBy,
      created_at: session.createdAt,
      active: session.active ? 1 : 0,
    };
  }

  async addIngameSessionParticipant(sessionId: number, discordId: string, username: string): Promise<void> {
    await this.ready;
    await IngameSessionModel.updateOne(
      { id: sessionId, 'participants.discordId': { $ne: discordId } },
      { $push: { participants: { discordId, username } } }
    );
  }

  async removeIngameSessionParticipant(sessionId: number, discordId: string): Promise<void> {
    await this.ready;
    await IngameSessionModel.updateOne({ id: sessionId }, { $pull: { participants: { discordId } } });
  }

  async setIngameSessionAnnouncementMessageId(sessionId: number, messageId: string): Promise<void> {
    await this.ready;
    await IngameSessionModel.updateOne({ id: sessionId }, { $set: { lastQAnnouncementMessageId: messageId } });
  }

  async removeIngameSessionQParticipant(sessionId: number, discordId: string): Promise<void> {
    await this.ready;
    await IngameSessionQParticipantModel.deleteOne({ sessionId, discordId });
  }

  async getIngameSessionParticipants(sessionId: number): Promise<Array<{ id: string; username: string }>> {
    await this.ready;
    const session = await IngameSessionModel.findOne({ id: sessionId }).lean();
    if (!session) {
      return [];
    }

    return (session.participants ?? []).map((participant: any) => ({
      id: participant.discordId,
      username: participant.username,
    }));
  }

  async closeIngameSession(sessionId: number): Promise<void> {
    await this.ready;
    await IngameSessionModel.updateOne({ id: sessionId }, { $set: { active: false } });
    await IngameSessionQParticipantModel.deleteMany({ sessionId });
  }

  async addIngameSessionQParticipant(sessionId: number, discordId: string, username: string): Promise<boolean> {
    await this.ready;
    const id = await this.nextId('ingame_session_q_participants');
    const result = await IngameSessionQParticipantModel.updateOne(
      { sessionId, discordId },
      {
        $setOnInsert: {
          id,
          sessionId,
          discordId,
          username,
          joinedAt: new Date(),
        },
      },
      { upsert: true }
    );

    return Number(result.upsertedCount ?? 0) > 0;
  }

  async getIngameSessionQParticipants(sessionId: number): Promise<Array<{ id: string; username: string; joined_at: Date }>> {
    await this.ready;
    const participants = await IngameSessionQParticipantModel.find({ sessionId }).sort({ joinedAt: 1 }).lean();
    return participants.map((participant) => ({
      id: participant.discordId,
      username: participant.username,
      joined_at: participant.joinedAt,
    }));
  }

  async incrementIngameQMiss(discordId: string, username: string): Promise<{ miss_count: number }> {
    await this.ready;
    const result = await IngameQMissModel.findOneAndUpdate(
      { discordId },
      {
        $set: {
          username,
          updatedAt: new Date(),
        },
        $setOnInsert: { discordId },
        $inc: { missCount: 1 },
      },
      { upsert: true, new: true }
    ).lean();

    return { miss_count: Number(result?.missCount ?? 0) };
  }

  async resetIngameQMiss(discordId: string): Promise<void> {
    await this.ready;
    await IngameQMissModel.deleteOne({ discordId });
  }

  async getIngameQWaitingCount(): Promise<number> {
    await this.ready;
    return IngameQMissModel.countDocuments({ missCount: { $gt: 0 } });
  }

  async addBotLog(action: string, userId: string, username: string, details?: string): Promise<void> {
    await this.ready;
    const id = await this.nextId('bot_logs');
    await BotLogModel.create({
      id,
      action,
      userId,
      username,
      details: details || null,
      loggedAt: new Date(),
    });
  }

  async close(): Promise<void> {
    await this.ready;
    await disconnectMongo();
  }
}

export const db = new DatabaseManager();
