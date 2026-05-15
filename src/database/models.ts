import mongoose, { Schema } from 'mongoose';

const CounterSchema = new Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false }
);

export const CounterModel = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

export async function getNextSequence(name: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return Number(counter?.seq ?? 1);
}

const commonIdSchema = {
  id: { type: Number, required: true, unique: true, index: true },
};

const AktiflikLogSchema = new Schema(
  {
    ...commonIdSchema,
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    checkedAt: { type: Date, required: true },
    checkedDate: { type: String, required: true },
  },
  { versionKey: false }
);
AktiflikLogSchema.index({ discordId: 1, checkedDate: 1 }, { unique: true });
export const AktiflikLogModel = mongoose.models.AktiflikLog || mongoose.model('AktiflikLog', AktiflikLogSchema);

const BanSchema = new Schema(
  {
    ...commonIdSchema,
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    reason: { type: String, required: true },
    bannedBy: { type: String, required: true },
    bannedAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { versionKey: false }
);
BanSchema.index({ discordId: 1, active: 1 });
export const BanModel = mongoose.models.Ban || mongoose.model('Ban', BanSchema);

const FarmLogSchema = new Schema(
  {
    ...commonIdSchema,
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    amount: { type: Number, required: true },
    givenAt: { type: Date, required: true },
  },
  { versionKey: false }
);
FarmLogSchema.index({ discordId: 1, givenAt: -1 });
export const FarmLogModel = mongoose.models.FarmLog || mongoose.model('FarmLog', FarmLogSchema);

const IngameParticipantSchema = new Schema(
  {
    discordId: { type: String, required: true },
    username: { type: String, required: true },
  },
  { _id: false, versionKey: false }
);

const IngameSessionSchema = new Schema(
  {
    ...commonIdSchema,
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    participants: { type: [IngameParticipantSchema], default: [] },
    lastQAnnouncementMessageId: { type: String, default: null },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { versionKey: false }
);
IngameSessionSchema.index({ active: 1, createdAt: -1 });
IngameSessionSchema.index({ createdAt: -1 });
export const IngameSessionModel = mongoose.models.IngameSession || mongoose.model('IngameSession', IngameSessionSchema);

const BotLogSchema = new Schema(
  {
    ...commonIdSchema,
    action: { type: String, required: true },
    userId: { type: String, required: true },
    username: { type: String, required: true },
    details: { type: String, default: null },
    loggedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
BotLogSchema.index({ loggedAt: -1 });
export const BotLogModel = mongoose.models.BotLog || mongoose.model('BotLog', BotLogSchema);

const IngameQMissSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    missCount: { type: Number, default: 0 },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
export const IngameQMissModel = mongoose.models.IngameQMiss || mongoose.model('IngameQMiss', IngameQMissSchema);

const IngameSessionQParticipantSchema = new Schema(
  {
    ...commonIdSchema,
    sessionId: { type: Number, required: true, index: true },
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
IngameSessionQParticipantSchema.index({ sessionId: 1, discordId: 1 }, { unique: true });
export const IngameSessionQParticipantModel = mongoose.models.IngameSessionQParticipant || mongoose.model('IngameSessionQParticipant', IngameSessionQParticipantSchema);

const AktiflikSessionSchema = new Schema(
  {
    ...commonIdSchema,
    messageId: { type: String, required: true, unique: true, index: true },
    channelId: { type: String, required: true },
    targetRoleId: { type: String, required: true },
    durationSeconds: { type: Number, required: true },
    createdBy: { type: String, required: true },
    createdAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    active: { type: Boolean, default: true },
  },
  { versionKey: false }
);
AktiflikSessionSchema.index({ active: 1, endsAt: 1 });
AktiflikSessionSchema.index({ createdAt: -1 });
export const AktiflikSessionModel = mongoose.models.AktiflikSession || mongoose.model('AktiflikSession', AktiflikSessionSchema);

const AktiflikSessionParticipantSchema = new Schema(
  {
    ...commonIdSchema,
    sessionId: { type: Number, required: true, index: true },
    discordId: { type: String, required: true },
    username: { type: String, required: true },
    joinedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
AktiflikSessionParticipantSchema.index({ sessionId: 1, discordId: 1 }, { unique: true });
export const AktiflikSessionParticipantModel = mongoose.models.AktiflikSessionParticipant || mongoose.model('AktiflikSessionParticipant', AktiflikSessionParticipantSchema);

const AktiflikMemberStatusSchema = new Schema(
  {
    discordId: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true },
    consecutiveMisses: { type: Number, default: 0 },
    totalMisses: { type: Number, default: 0 },
    lastSeenAt: { type: Date, default: null },
    updatedAt: { type: Date, required: true },
  },
  { versionKey: false }
);
export const AktiflikMemberStatusModel = mongoose.models.AktiflikMemberStatus || mongoose.model('AktiflikMemberStatus', AktiflikMemberStatusSchema);
