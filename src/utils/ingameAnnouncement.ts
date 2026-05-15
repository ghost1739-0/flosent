import { EmbedBuilder } from 'discord.js';

type IngameSessionLike = {
  id: number;
  message_id: string;
  channel_id: string;
  last_q_announcement_message_id: string | null;
};

type IngameEmbedLike = {
  fields: Array<{ name: string; value: string }>;
};

type IngameStatus = {
  totalCapacity: number;
  participantCount: number;
};

export function getIngameTotalCapacity(embed: IngameEmbedLike | undefined): number {
  const totalField = embed?.fields.find((field) => field.name === '📊 Toplam');
  if (!totalField) {
    return 20;
  }

  const match = totalField.value.match(/(?:Katılımcı Sayısı:\s*)?(\d+)\s*\/\s*(\d+)/i);
  if (!match) {
    return 20;
  }

  const capacity = Number(match[2]);
  return Number.isFinite(capacity) && capacity > 0 ? capacity : 20;
}

export function getIngameStatus(embed: IngameEmbedLike | undefined): IngameStatus {
  const totalCapacity = getIngameTotalCapacity(embed);
  const participantField = embed?.fields.find((field) => field.name === '👥 Katılımcılar');
  const participantCount = participantField && participantField.value.trim() !== 'Yok'
    ? participantField.value.split('\n').filter((line) => line.trim().length > 0).length
    : 0;

  return { totalCapacity, participantCount };
}

export function getIngameAnnouncementContent(totalCapacity: number, participantCount: number): string {
  const availableSlots = Math.max(totalCapacity - participantCount, 0);
  return `ingamee ${availableSlots} kişilik yer var gelmek isteyen gelsin.`;
}

export async function syncIngameAnnouncement(
  channel: any,
  session: IngameSessionLike,
  currentEmbed?: IngameEmbedLike
): Promise<void> {
  if (!channel || !('messages' in channel) || !('send' in channel)) {
    return;
  }

  const { totalCapacity, participantCount } = getIngameStatus(currentEmbed);
  const announcementContent = getIngameAnnouncementContent(totalCapacity, participantCount);

  if (session.last_q_announcement_message_id) {
    const previousAnnouncement = await channel.messages.fetch(session.last_q_announcement_message_id).catch(() => null);
    if (previousAnnouncement) {
      await previousAnnouncement.edit({ content: announcementContent, allowedMentions: { parse: [] } });
      return;
    }
  }

  const newAnnouncement = await channel.send({
    content: announcementContent,
    allowedMentions: { parse: [] },
  });

  if ('db' in channel.client) {
    await channel.client.db.setIngameSessionAnnouncementMessageId(session.id, newAnnouncement.id);
  }
}

export function buildUpdatedIngameEmbed(
  currentEmbed: IngameEmbedLike,
  participants: Array<{ id: string; username: string }>,
  qParticipants: Array<{ id: string; username: string }>,
  totalCapacity: number
): EmbedBuilder {
  const preservedFields = currentEmbed.fields.filter((field) => !['👥 Katılımcılar', '🟦 Q Atanlar', '📊 Toplam'].includes(field.name));

  return EmbedBuilder.from(currentEmbed as any).setFields(
    {
      name: '👥 Katılımcılar',
      value: participants.length ? participants.map((participant) => `<@${participant.id}>`).join('\n') : 'Yok',
      inline: false,
    },
    {
      name: '🟦 Q Atanlar',
      value: qParticipants.length ? qParticipants.map((participant) => `<@${participant.id}>`).join('\n') : 'Yok',
      inline: false,
    },
    {
      name: '📊 Toplam',
      value: `Katılımcı Sayısı: ${participants.length}/${totalCapacity}`,
      inline: false,
    },
    ...preservedFields
  );
}