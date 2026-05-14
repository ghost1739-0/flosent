import { EmbedBuilder, Message } from 'discord.js';
import type { BotClient, BotEvent } from '../types';

const Q_CHANNEL_ID = '1500135056847409175';
const LOG_CHANNEL_ID = '1500440719058276482';
const MAX_INGAME_PLAYERS = 20;

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
  const displayName = message.member && 'displayName' in message.member
    ? (message.member as any).displayName
    : message.author.username;

  const logChannel = guild.channels.cache.get(LOG_CHANNEL_ID)
    ?? await guild.channels.fetch(LOG_CHANNEL_ID).catch(() => null);

  const activeSession = await client.db.getActiveIngameSession();
  if (!activeSession) {
    if (logChannel && 'send' in logChannel) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('ℹ️ Q Kaydı')
            .setDescription(`${message.author} q yazdı ama aktif bir ingame oturumu yok.`)
            .setColor('Yellow'),
        ],
      });
    }
    return;
  }

  const participants = await client.db.getIngameSessionParticipants(activeSession.id);
  const participantIds = new Set(participants.map((participant) => participant.id));
  const remaining = Math.max(MAX_INGAME_PLAYERS - participants.length, 0);

  if (participantIds.has(message.author.id)) {
    await client.db.resetIngameQMiss(message.author.id);
  } else {
    const miss = await client.db.incrementIngameQMiss(message.author.id, message.author.username);
    if (miss.miss_count >= 3 && logChannel && 'send' in logChannel) {
      await logChannel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle('⚠️ Tiklememe Kaydı')
            .setDescription(`${message.author} 3 defa q atıp ingame'e girmedi.`)
            .addFields({ name: 'Kullanıcı', value: `${displayName}`, inline: true })
            .setColor('Red'),
        ],
      });
      await client.db.resetIngameQMiss(message.author.id);
    }
  }

  const activeChannel = guild.channels.cache.get(activeSession.channel_id)
    ?? await guild.channels.fetch(activeSession.channel_id).catch(() => null);
  if (activeChannel && 'send' in activeChannel && remaining > 0) {
    await activeChannel.send({
      content: `ingamee ${remaining} kişilik yer var ilk giren gelir.`,
      allowedMentions: { parse: [] },
    });
  }

  if (logChannel && 'send' in logChannel) {
    await logChannel.send({
      embeds: [
        new EmbedBuilder()
          .setTitle('📝 Q Mesajı')
          .setDescription(`${message.author} q yazdı.`)
          .addFields(
            { name: 'Kalan Yer', value: `${remaining}`, inline: true },
            { name: 'Aktif Oturum', value: `${activeSession.id}`, inline: true }
          )
          .setColor('Blue'),
      ],
    });
  }
}

export default { name, execute } satisfies BotEvent;