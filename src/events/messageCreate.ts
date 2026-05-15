import { EmbedBuilder, Message, type TextBasedChannel } from 'discord.js';
import type { BotClient, BotEvent } from '../types';
import { buildUpdatedIngameEmbed, getIngameTotalCapacity, syncIngameAnnouncement } from '../utils/ingameAnnouncement';

const Q_CHANNEL_ID = '1500135056847409175';
const LOG_CHANNEL_ID = '1500440719058276482';

function isTextBasedChannel(channel: unknown): channel is TextBasedChannel {
  return !!channel
    && typeof channel === 'object'
    && 'isTextBased' in channel
    && typeof (channel as { isTextBased?: unknown }).isTextBased === 'function'
    && (channel as { isTextBased: () => boolean }).isTextBased();
}

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
      await logChannel.send({ content: `${message.author.username} q yazdı ama aktif bir ingame oturumu yok.` });
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
      await logChannel.send({ content: `${message.author.username} 3 defa q atıp ingame'e girmedi.` });
      await client.db.resetIngameQMiss(message.author.id);
    }
  }

  const updatedParticipants = await client.db.getIngameSessionParticipants(session.id);
  const qParticipants = await client.db.getIngameSessionQParticipants(session.id);

  const activeChannel = guild.channels.cache.get(session.channel_id)
    ?? await guild.channels.fetch(session.channel_id).catch(() => null);

  if (isTextBasedChannel(activeChannel)) {
    const messageTarget = await activeChannel.messages.fetch(session.message_id).catch(() => null);
    if (messageTarget) {
      const currentEmbed = messageTarget.embeds[0];
      if (currentEmbed) {
        const totalCapacity = getIngameTotalCapacity(currentEmbed);
        const updatedEmbed = buildUpdatedIngameEmbed(currentEmbed, updatedParticipants, qParticipants, totalCapacity);

        await messageTarget.edit({ embeds: [updatedEmbed] });
        await syncIngameAnnouncement(activeChannel, session, updatedEmbed.toJSON());
      }
    }
  }

  if (logChannel && 'send' in logChannel) {
    await logChannel.send({ content: `${message.author.username} q yazdı.` });
  }
}

export default { name, execute } satisfies BotEvent;