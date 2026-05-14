import { Message } from 'discord.js';
import type { BotClient, BotEvent } from '../types';

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
  const participants = activeSession ? await client.db.getIngameSessionParticipants(activeSession.id) : [];
  const participantIds = new Set(participants.map((participant) => participant.id));

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

  if (activeSession) {
    const activeChannel = guild.channels.cache.get(activeSession.channel_id)
      ?? await guild.channels.fetch(activeSession.channel_id).catch(() => null);
    const waitingCount = await client.db.getIngameQWaitingCount();

    if (activeChannel && 'send' in activeChannel && waitingCount > 0) {
      await activeChannel.send({
        content: `ingamee ${waitingCount} kişilik yer var gelmek isteyen gelsin.`,
        allowedMentions: { parse: [] },
      });
    }
  }

  if (logChannel && 'send' in logChannel) {
    await logChannel.send({ content: `<@${message.author.id}> q yazdı.` });
  }
}

export default { name, execute } satisfies BotEvent;