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

  const activeSession = await client.db.getActiveIngameSession();
  if (!activeSession) {
    if (logChannel && 'send' in logChannel) {
      await logChannel.send({ content: `<@${message.author.id}> q yazdı ama aktif bir ingame oturumu yok.` });
    }
    return;
  }

  const participants = await client.db.getIngameSessionParticipants(activeSession.id);
  const participantIds = new Set(participants.map((participant) => participant.id));

  const qAdded = await client.db.addIngameSessionQParticipant(activeSession.id, message.author.id, message.author.username);
  const qParticipants = await client.db.getIngameSessionQParticipants(activeSession.id);

  if (participantIds.has(message.author.id)) {
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

  const activeChannel = guild.channels.cache.get(activeSession.channel_id)
    ?? await guild.channels.fetch(activeSession.channel_id).catch(() => null);

  if (activeChannel && 'messages' in activeChannel) {
    const messageTarget = await activeChannel.messages.fetch(activeSession.message_id).catch(() => null);
    if (messageTarget) {
      const currentEmbed = messageTarget.embeds[0];
      if (currentEmbed) {
        const updatedEmbed = EmbedBuilder.from(currentEmbed).setFields(
          {
            name: '👥 Katılımcılar',
            value: formatMentionList(participants),
            inline: false,
          },
          {
            name: '🟦 Q Atanlar',
            value: formatMentionList(qParticipants),
            inline: false,
          },
          {
            name: '📊 Toplam',
            value: `Katılımcı Sayısı: ${participants.length}/20`,
            inline: false,
          }
        );

        await messageTarget.edit({ embeds: [updatedEmbed] });
      }
    }
  }

  if (activeChannel && 'send' in activeChannel && qAdded) {
    await activeChannel.send({
      content: `ingamee ${qParticipants.length} kişilik yer var gelmek isteyen gelsin.`,
      allowedMentions: { parse: [] },
    });
  }

  if (logChannel && 'send' in logChannel) {
    await logChannel.send({ content: `<@${message.author.id}> q yazdı.` });
  }
}

export default { name, execute } satisfies BotEvent;