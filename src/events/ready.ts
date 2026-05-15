import {
  ActivityType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  GuildMember,
} from 'discord.js';
import type { BotClient, BotEvent } from '../types';
import { sendAktiflikPanelMessage } from '../commands/aktiflik';

const turkishDate = (date: Date = new Date()) => {
  return date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

function formatMemberLines(members: GuildMember[], icon: string): string {
  if (!members.length) {
    return 'Yok';
  }

  const lines: string[] = [];
  for (const member of members) {
    const line = `${icon} ${member.displayName}`;
    const candidate = [...lines, line].join('\n');
    if (candidate.length > 1000) {
      break;
    }
    lines.push(line);
  }

  if (members.length > lines.length) {
    lines.push(`... ve ${members.length - lines.length} kisi daha`);
  }

  return lines.join('\n');
}

function formatMemberMentionLines(members: GuildMember[], icon: string): string {
  if (!members.length) {
    return 'Yok';
  }

  const lines: string[] = [];
  for (const member of members) {
    const line = `${icon} <@${member.id}>`;
    const candidate = [...lines, line].join('\n');
    if (candidate.length > 1000) {
      break;
    }
    lines.push(line);
  }

  if (members.length > lines.length) {
    lines.push(`... ve ${members.length - lines.length} kisi daha`);
  }

  return lines.join('\n');
}

async function finalizeAktiflikSessionByRow(
  client: BotClient,
  guild: Guild,
  session: {
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    ends_at: Date;
    active: number;
  }
): Promise<void> {
  if (session.active !== 1) {
    return;
  }

  const latest = await client.db.getAktiflikSessionByMessageId(session.message_id);
  if (!latest || latest.active !== 1 || latest.id !== session.id) {
    return;
  }

  await client.db.closeAktiflikSession(session.id);

  const channel = guild.channels.cache.get(session.channel_id)
    ?? await guild.channels.fetch(session.channel_id).catch(() => null);
  if (!channel || !('messages' in channel)) {
    return;
  }

  const message = await channel.messages.fetch(session.message_id).catch(() => null);
  if (!message) {
    return;
  }

  await guild.members.fetch().catch((error) => {
    // eslint-disable-next-line no-console
    console.error('[Aktiflik] Member fetch hatasi:', error);
  });

  const role = guild.roles.cache.get('1500135055207567590');
  const roleMembers = role ? Array.from(role.members.values()) : [];

  const participants = await client.db.getAktiflikSessionParticipants(session.id);
  const joinedIds = new Set(participants.map((participant: { id: string }) => participant.id));
  const joinedMembers = roleMembers.filter((member) => joinedIds.has(member.id));
  const missedMembers = roleMembers.filter((member) => !joinedIds.has(member.id));

  for (const member of joinedMembers) {
    await client.db.markAktiflikJoined(member.id, member.displayName);
  }

  const currentEmbed = message.embeds[0];
  const closedEmbed = (currentEmbed ? EmbedBuilder.from(currentEmbed) : new EmbedBuilder())
    .setTitle('✅ Aktiflik Kontrolu Kapatildi')
    .setDescription('Sure doldu, aktiflik onaylama kapatildi.')
    .setFields(
      {
        name: '📊 Katilim Ozeti',
        value: `Toplam: **${roleMembers.length}**\nKatılan: **${joinedMembers.length}**\nKatılmayan: **${missedMembers.length}**`,
        inline: false,
      },
      {
        name: `❌ Katılmayanlar (${missedMembers.length})`,
        value: missedMembers.length ? formatMemberMentionLines(missedMembers, '❌') : 'Yok',
        inline: false,
      }
    )
    .setColor('DarkGreen')
    .setFooter({ text: `Bitiş: ${turkishDate()}` });

  const disabledButton = new ButtonBuilder()
    .setCustomId(`aktiflik_kapali_${session.id}`)
    .setLabel('✅ Aktiflik Kapandi')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

  try {
    await message.edit({
      content: null,
      embeds: [closedEmbed],
      components: [row],
    });
  } catch (error) {
    console.error('[Aktiflik] Ready kapanış mesajı güncellenemedi:', error);
  }

  try {
    await sendAktiflikPanelMessage(client, guild, session.id, missedMembers, joinedMembers, roleMembers.length);
  } catch (error) {
    console.error('[Aktiflik] Ready panel mesajı gönderilemedi:', error);
  }

  try {
    await client.db.addBotLog(
      'aktiflik_otomatik_kapandi',
      'SYSTEM',
      'SYSTEM',
      `Oturum ${session.id} otomatik kapatıldı. Katılmayan: ${missedMembers.length}`
    );
    console.log(`[Aktiflik] Log yazıldı. Session: ${session.id}`);
  } catch (error) {
    console.error(`[Aktiflik] Log yazma hatası:`, error);
  }
}

async function recoverAndScheduleAktiflikSessions(client: BotClient): Promise<void> {
  const sessions = await client.db.getActiveAktiflikSessions();
  if (!sessions.length) {
    return;
  }

  for (const session of sessions) {
    let guild: Guild | null = null;
    for (const [, cachedGuild] of client.guilds.cache) {
      const found = cachedGuild.channels.cache.get(session.channel_id)
        ?? await cachedGuild.channels.fetch(session.channel_id).catch(() => null);
      if (found) {
        guild = cachedGuild;
        break;
      }
    }

    if (!guild) {
      await client.db.closeAktiflikSession(session.id);
      continue;
    }

    const msLeft = session.ends_at.getTime() - Date.now();
    if (msLeft <= 0) {
      await finalizeAktiflikSessionByRow(client, guild, session);
      continue;
    }

    setTimeout(() => {
      finalizeAktiflikSessionByRow(client, guild as Guild, session).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Aktiflik recovery kapatma hatasi:', error);
      });
    }, msLeft);
  }
}

async function sweepExpiredAktiflikSessions(client: BotClient): Promise<void> {
  const sessions = await client.db.getActiveAktiflikSessions();
  if (!sessions.length) {
    return;
  }

  for (const session of sessions) {
    if (session.ends_at.getTime() > Date.now()) {
      continue;
    }

    let guild: Guild | null = null;
    for (const [, cachedGuild] of client.guilds.cache) {
      const found = cachedGuild.channels.cache.get(session.channel_id)
        ?? await cachedGuild.channels.fetch(session.channel_id).catch(() => null);
      if (found) {
        guild = cachedGuild;
        break;
      }
    }

    if (!guild) {
      await client.db.closeAktiflikSession(session.id);
      continue;
    }

    await finalizeAktiflikSessionByRow(client, guild, session);
  }
}

export const name = 'ready';
export const once = true;

export async function execute(client: import('discord.js').Client): Promise<void> {
  const botClient = client as BotClient;
  // eslint-disable-next-line no-console
  console.log(`Bot altyapı modunda hazır: ${client.user?.tag ?? 'Bilinmiyor'}`);
  client.user?.setPresence({
    activities: [{ name: 'Altyapı modu', type: ActivityType.Playing }],
    status: 'online',
  });

  await recoverAndScheduleAktiflikSessions(botClient);

  // Safety net: if any timer is missed, expired sessions are force-finalized.
  setInterval(() => {
    sweepExpiredAktiflikSessions(botClient).catch((error) => {
      // eslint-disable-next-line no-console
      console.error('Aktiflik sweep hatasi:', error);
    });
  }, 5000);
}

export default { name, once, execute } satisfies BotEvent;
