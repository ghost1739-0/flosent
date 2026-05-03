import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Guild,
  GuildMember,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const AKTIFLIK_CHANNEL_ID = '1500137490042851450';
const AKTIFLIK_ROLE_ID = '1500135055207567595';
const AKTIFLIK_PENALTY_CHANNEL_ID = '1500135056847409172';
const PENALTY_ROLE_1 = '1500496578052362280';
const PENALTY_ROLE_2 = '1500496724152553614';
const PENALTY_ROLE_3 = '1500496699171405895';

function formatMemberLines(members: GuildMember[], icon: string): string {
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
    lines.push(`... ve ${members.length - lines.length} kişi daha`);
  }

  return lines.join('\n');
}

async function applyPenaltyForMissedMember(
  member: GuildMember,
  client: BotClient,
  guild: Guild,
  reasonChannelId: string
): Promise<void> {
  const status = client.db.incrementAktiflikMiss(member.id, member.displayName);

  const role1 = guild.roles.cache.get(PENALTY_ROLE_1);
  const role2 = guild.roles.cache.get(PENALTY_ROLE_2);
  const role3 = guild.roles.cache.get(PENALTY_ROLE_3);

  try {
    if (status.consecutive_misses === 1) {
      if (role2 && member.roles.cache.has(role2.id)) {
        await member.roles.remove(role2);
      }
      if (role3 && member.roles.cache.has(role3.id)) {
        await member.roles.remove(role3);
      }
      if (role1 && !member.roles.cache.has(role1.id)) {
        await member.roles.add(role1);
      }
    } else if (status.consecutive_misses === 2) {
      if (role1 && member.roles.cache.has(role1.id)) {
        await member.roles.remove(role1);
      }
      if (role3 && member.roles.cache.has(role3.id)) {
        await member.roles.remove(role3);
      }
      if (role2 && !member.roles.cache.has(role2.id)) {
        await member.roles.add(role2);
      }
    } else if (status.consecutive_misses >= 3) {
      if (role1 && member.roles.cache.has(role1.id)) {
        await member.roles.remove(role1);
      }
      if (role2 && member.roles.cache.has(role2.id)) {
        await member.roles.remove(role2);
      }
      if (role3 && !member.roles.cache.has(role3.id)) {
        await member.roles.add(role3);
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Aktiflik rol uygulama hatasi:', error);
  }

  const penaltyChannel = guild.channels.cache.get(reasonChannelId) ?? await guild.channels.fetch(reasonChannelId).catch(() => null);
  if (penaltyChannel && 'send' in penaltyChannel) {
    let roleText = 'ceza rolu guncellenemedi';
    if (status.consecutive_misses === 1) {
      roleText = `<@&${PENALTY_ROLE_1}>`;
    } else if (status.consecutive_misses === 2) {
      roleText = `<@&${PENALTY_ROLE_2}>`;
    } else if (status.consecutive_misses >= 3) {
      roleText = `<@&${PENALTY_ROLE_3}>`;
    }

    await penaltyChannel.send({
      content: `${member} aktiflik tiklememe nedeniyle ${roleText} rolunu aldi. (ust uste: ${status.consecutive_misses})`,
      allowedMentions: { parse: [] },
    });
  }
}

async function finalizeAktiflikSession(
  client: BotClient,
  guild: Guild,
  sessionId: number,
  messageId: string,
  channelId: string
): Promise<void> {
  const session = client.db.getAktiflikSessionByMessageId(messageId);
  if (!session || session.id !== sessionId || session.active !== 1) {
    return;
  }

  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !('messages' in channel)) {
    client.db.closeAktiflikSession(sessionId);
    return;
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    client.db.closeAktiflikSession(sessionId);
    return;
  }

  await guild.members.fetch();
  const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
  const roleMembers = role ? Array.from(role.members.values()) : [];

  const participants = client.db.getAktiflikSessionParticipants(sessionId);
  const joinedIds = new Set(participants.map((p) => p.id));

  const joinedMembers = roleMembers.filter((m) => joinedIds.has(m.id));
  const missedMembers = roleMembers.filter((m) => !joinedIds.has(m.id));

  for (const member of joinedMembers) {
    client.db.markAktiflikJoined(member.id, member.displayName);
  }

  for (const member of missedMembers) {
    await applyPenaltyForMissedMember(member, client, guild, AKTIFLIK_PENALTY_CHANNEL_ID);
  }

  const currentEmbed = message.embeds[0];
  const closedEmbed = (currentEmbed ? EmbedBuilder.from(currentEmbed) : new EmbedBuilder())
    .setTitle('✅ Aktiflik Kontrolü Sonuçları')
    .setDescription('Aktiflik kontrolü süresi doldu ve oturum kapatıldı.')
    .setFields(
      {
        name: '📊 Katılım Özeti',
        value: `Toplam: **${roleMembers.length}**\nKatılan: **${joinedMembers.length}**\nKatılmayan: **${missedMembers.length}**`,
        inline: false,
      },
      {
        name: `✅ Katılanlar (${joinedMembers.length})`,
        value: formatMemberLines(joinedMembers, '✅'),
        inline: true,
      },
      {
        name: `❌ Katılmayanlar (${missedMembers.length})`,
        value: formatMemberLines(missedMembers, '❌'),
        inline: true,
      }
    )
    .setColor('DarkGreen')
    .setFooter({ text: `Bitiş: ${turkishDate()}` });

  const disabledButton = new ButtonBuilder()
    .setCustomId(`aktiflik_kapali_${sessionId}`)
    .setLabel('Süre Doldu (Kapatıldı)')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);

  await message.edit({ embeds: [closedEmbed], components: [row] });
  client.db.closeAktiflikSession(sessionId);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aktiflik')
    .setDescription('Aktiflik kontrolü başlatır')
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Kac saniye aktiflik acik kalsin? (ornek: 8)')
        .setMinValue(5)
        .setMaxValue(3600)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(8), // Administrator

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;
      const durationSeconds = interaction.options.getInteger('sure') ?? 60;

      if (!guild) {
        await interaction.editReply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
        });
        return;
      }

      const channel = guild.channels.cache.get(AKTIFLIK_CHANNEL_ID) ?? await guild.channels.fetch(AKTIFLIK_CHANNEL_ID).catch(() => null);
      if (!channel || !('send' in channel)) {
        await interaction.editReply({
          content: '❌ Aktiflik kanalı bulunamadı.',
        });
        return;
      }

      await guild.members.fetch();
      const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
      const roleMembersCount = role ? role.members.size : 0;

      const embed = new EmbedBuilder()
        .setTitle('✅ Aktiflik Kontrolü')
        .setDescription(`Aşağıdaki butona tıklayarak aktifliğinizi onaylayın!\nKalan sure: ${durationSeconds} saniye`)
        .setColor('Green')
        .addFields({ name: '📊 Katilim', value: `0/${roleMembersCount}`, inline: false })
        .setFooter({ text: `Aktiflik kontrolü — ${turkishDate()}` });

      const button = new ButtonBuilder()
        .setCustomId('aktiflik_onayla_temp')
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const message = await channel.send({
        // content: '@everyone', // TODO: Re-enable @everyone mention later
        embeds: [embed],
        components: [row],
        // allowedMentions: { parse: ['everyone'] },
      });

      const sessionId = client.db.createAktiflikSession(
        message.id,
        message.channelId,
        AKTIFLIK_ROLE_ID,
        durationSeconds,
        interaction.user.id
      );

      const activeButton = new ButtonBuilder()
        .setCustomId(`aktiflik_onayla_${sessionId}`)
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);
      const activeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(activeButton);
      await message.edit({ components: [activeRow] });

      // Start timeout immediately; do not delay due to DM operations
      setTimeout(() => {
        finalizeAktiflikSession(client, guild, sessionId, message.id, message.channelId)
          .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Aktiflik kapatma hatasi:', error);
          });
      }, durationSeconds * 1000);

      // Send DM to all members with AKTIFLIK_ROLE_ID
      if (role) {
        const members = role.members;
        for (const [, member] of members) {
          member.send(
            '📢 Aktiflik kontrolü başladı! Aktifliğini onaylamak için sunucuya gel ve butona tıkla.'
          ).catch(() => {
            // Silently skip if DM fails
          });
        }
      }

      client.db.addBotLog(
        'aktiflik_kontrolu_baslatildi',
        interaction.user.id,
        interaction.user.username
      );

      await interaction.editReply({
        content: `✅ Aktiflik kontrolü başlatıldı! Sure: ${durationSeconds} saniye.`,
      });

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Aktiflik komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
