import { EmbedBuilder, Message } from 'discord.js';
import type { BotClient, BotEvent } from '../types';
import { formatMentionList } from '../utils/helpers';

const Q_CHANNEL_ID = '1500135056847409175';
const LOG_CHANNEL_ID = '1500440719058276482';

export const name = 'messageCreate';

export async function execute(message: Message): Promise<void> {
  if (message.author.bot || !message.guild) {
    return;
  }

  if (message.channelId !== Q_CHANNEL_ID) {
    return;
  }

  if (message.content.trim().toLowerCase() !== 'q') {
    return;
  }

  const client = message.client as BotClient;
  const guild = message.guild;

  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID)
    ?? await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

  const session = await client.db.getLatestIngameSession();
  if (!session) {
    if (logChannel && 'send' in logChannel) {
      await logChannel.send({ content: `<@${message.author.id}> q yazdı ama aktif bir ingame oturumu yok.` });
    }
    return;
  }

  const participants = await client.db.getIngameSessionParticipants(session.id);
  const participantIds = new Set(participants.map((participant) => participant.id));
  const wasParticipant = participantIds.has(message.author.id);

  const qAdded = await client.db.addIngameSessionQParticipant(session.id, message.author.id, message.author.username);

  await client.db.removeIngameSessionParticipant(session.id, message.author.id);

  if (wasParticipant) {
    await client.db.resetIngameQMiss(message.author.id);
  } else {
    const miss = await client.db.incrementIngameQMiss(message.author.id, message.author.username);
    if (miss.miss_count >= 3 && logChannel && 'send' in logChannel) {
      await logChannel.send({
        content: `<@${message.author.id}> 3 defa q atıp ingame'e girmedi.`,
        allowedMentions: { users: [message.author.id] },
      });
      await client.db.resetIngameQMiss(message.author.id);
    }
  }

  const updatedParticipants = await client.db.getIngameSessionParticipants(session.id);
  const qParticipants = await client.db.getIngameSessionQParticipants(session.id);
  const availableSlots = Math.max(20 - updatedParticipants.length, 0);

  const activeChannel = guild.channels.cache.get(session.channel_id)
    ?? await guild.channels.fetch(session.channel_id).catch(() => null);

  if (activeChannel && 'messages' in activeChannel) {
    const messageTarget = await activeChannel.messages.fetch(session.message_id).catch(() => null);
    if (messageTarget) {
      const currentEmbed = messageTarget.embeds[0];
      if (currentEmbed) {
        const preservedFields = currentEmbed.fields.filter((field) => !['👥 Katılımcılar', '🟦 Q Atanlar', '📊 Toplam'].includes(field.name));
        const updatedEmbed = EmbedBuilder.from(currentEmbed).setFields(
          {
            name: '👥 Katılımcılar',
            value: formatMentionList(updatedParticipants),
            inline: false,
          },
          {
            name: '🟦 Q Atanlar',
            value: formatMentionList(qParticipants),
            inline: false,
          },
          {
            name: '📊 Toplam',
            value: `Katılımcı Sayısı: ${updatedParticipants.length}/20`,
            inline: false,
          },
          ...preservedFields
        );

        await messageTarget.edit({ embeds: [updatedEmbed] });
      }
    }
  }

  if (session.active === 1 && activeChannel && ('send' in activeChannel || 'messages' in activeChannel) && (qAdded || wasParticipant)) {
    const announcementContent = `ingamee ${availableSlots} kişilik yer var gelmek isteyen gelsin.`;
    const announcementMessageId = session.last_q_announcement_message_id;

    if (announcementMessageId && 'messages' in activeChannel) {
      const previousAnnouncement = await activeChannel.messages.fetch(announcementMessageId).catch(() => null);
      if (previousAnnouncement) {
        await previousAnnouncement.edit({ content: announcementContent, allowedMentions: { parse: [] } });
      } else {
        const newAnnouncement = await activeChannel.send({
          content: announcementContent,
          allowedMentions: { parse: [] },
        });
        await client.db.setIngameSessionAnnouncementMessageId(session.id, newAnnouncement.id);
      }
    } else if ('send' in activeChannel) {
      const newAnnouncement = await activeChannel.send({
        content: announcementContent,
        allowedMentions: { parse: [] },
      });
      await client.db.setIngameSessionAnnouncementMessageId(session.id, newAnnouncement.id);
    }
  }

  if (logChannel && 'send' in logChannel) {
    await logChannel.send({ content: `<@${message.author.id}> q yazdı.` });
  }
}

export default { name, execute } satisfies BotEvent;