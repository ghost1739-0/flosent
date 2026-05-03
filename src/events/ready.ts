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

const AKTIFLIK_PENALTY_CHANNEL_ID = '1500135056847409172';
const PENALTY_ROLE_1 = '1500496578052362280';
const PENALTY_ROLE_2 = '1500496724152553614';
const PENALTY_ROLE_3 = '1500496699171405895';

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

async function applyPenaltyForMissedMember(
  member: GuildMember,
  client: BotClient,
  guild: Guild
): Promise<void> {
  const status = client.db.incrementAktiflikMiss(member.id, member.displayName);

  const role1 = guild.roles.cache.get(PENALTY_ROLE_1);
  const role2 = guild.roles.cache.get(PENALTY_ROLE_2);
  const role3 = guild.roles.cache.get(PENALTY_ROLE_3);

  try {
    if (status.consecutive_misses === 1) {
      if (role2 && member.roles.cache.has(role2.id)) await member.roles.remove(role2);
      if (role3 && member.roles.cache.has(role3.id)) await member.roles.remove(role3);
      if (role1 && !member.roles.cache.has(role1.id)) await member.roles.add(role1);
    } else if (status.consecutive_misses === 2) {
      if (role1 && member.roles.cache.has(role1.id)) await member.roles.remove(role1);
      if (role3 && member.roles.cache.has(role3.id)) await member.roles.remove(role3);
      if (role2 && !member.roles.cache.has(role2.id)) await member.roles.add(role2);
    } else if (status.consecutive_misses >= 3) {
      if (role1 && member.roles.cache.has(role1.id)) await member.roles.remove(role1);
      if (role2 && member.roles.cache.has(role2.id)) await member.roles.remove(role2);
      if (role3 && !member.roles.cache.has(role3.id)) await member.roles.add(role3);
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Aktiflik rol uygulama hatasi:', error);
  }

  const penaltyChannel = guild.channels.cache.get(AKTIFLIK_PENALTY_CHANNEL_ID)
    ?? await guild.channels.fetch(AKTIFLIK_PENALTY_CHANNEL_ID).catch(() => null);
  if (penaltyChannel && 'send' in penaltyChannel) {
    let roleText = 'ceza rolu guncellenemedi';
    if (status.consecutive_misses === 1) roleText = `<@&${PENALTY_ROLE_1}>`;
    else if (status.consecutive_misses === 2) roleText = `<@&${PENALTY_ROLE_2}>`;
    else if (status.consecutive_misses >= 3) roleText = `<@&${PENALTY_ROLE_3}>`;

    await penaltyChannel.send({
      content: `${member} aktiflik tiklememe nedeniyle ${roleText} rolunu aldi. (ust uste: ${status.consecutive_misses})`,
      allowedMentions: { parse: [] },
    });
  }
}

async function finalizeAktiflikSessionByRow(
  client: BotClient,
  guild: Guild,
  session: {
    id: number;
    message_id: string;
    channel_id: string;
    target_role_id: string;
    ends_at: string;
    active: number;
  }
): Promise<void> {
  if (session.active !== 1) {
    return;
  }

  const latest = client.db.getAktiflikSessionByMessageId(session.message_id);
  if (!latest || latest.active !== 1 || latest.id !== session.id) {
    return;
  }

  const channel = guild.channels.cache.get(session.channel_id)
    ?? await guild.channels.fetch(session.channel_id).catch(() => null);
  if (!channel || !('messages' in channel)) {
    client.db.closeAktiflikSession(session.id);
    return;
  }

  const message = await channel.messages.fetch(session.message_id).catch(() => null);
  if (!message) {
    client.db.closeAktiflikSession(session.id);
    return;
  }

  await guild.members.fetch();
  const role = guild.roles.cache.get(session.target_role_id);
  const roleMembers = role ? Array.from(role.members.values()) : [];

  const participants = client.db.getAktiflikSessionParticipants(session.id);
  const joinedIds = new Set(participants.map((p) => p.id));
  const joinedMembers = roleMembers.filter((m) => joinedIds.has(m.id));
  const missedMembers = roleMembers.filter((m) => !joinedIds.has(m.id));

  for (const member of joinedMembers) {
    client.db.markAktiflikJoined(member.id, member.displayName);
  }

  for (const member of missedMembers) {
    await applyPenaltyForMissedMember(member, client, guild);
  }

  const currentEmbed = message.embeds[0];
  const closedEmbed = (currentEmbed ? EmbedBuilder.from(currentEmbed) : new EmbedBuilder())
    .setTitle('✅ Aktiflik Kontrolu Kapatildi')
    .setDescription('Sure doldu, aktiflik onaylama kapatildi.')
    .setFields(
      {
        name: '📊 Katilim',
        value: `${joinedMembers.length}/${roleMembers.length}`,
        inline: false,
      },
      {
        name: `✅ Katilanlar (${joinedMembers.length})`,
        value: formatMemberLines(joinedMembers, '✅'),
        inline: false,
      },
      {
        name: `❌ Katilmayanlar (${missedMembers.length})`,
        value: formatMemberLines(missedMembers, '❌'),
        inline: false,
      }
    )
    .setColor('Red')
    .setFooter({ text: `Kapatildi — ${turkishDate()}` });

  const disabledButton = new ButtonBuilder()
    .setCustomId(`aktiflik_kapali_${session.id}`)
    .setLabel('✅ Aktiflik Kapandi')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

  await message.edit({ embeds: [closedEmbed], components: [row] });
  client.db.closeAktiflikSession(session.id);
}

async function recoverAndScheduleAktiflikSessions(client: BotClient): Promise<void> {
  const sessions = client.db.getActiveAktiflikSessions();
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
      client.db.closeAktiflikSession(session.id);
      continue;
    }

    const msLeft = new Date(session.ends_at).getTime() - Date.now();
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
  const sessions = client.db.getActiveAktiflikSessions();
  if (!sessions.length) {
    return;
  }

  for (const session of sessions) {
    if (new Date(session.ends_at).getTime() > Date.now()) {
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
      client.db.closeAktiflikSession(session.id);
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