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

const AKTIFLIK_CHANNEL_ID = '1500135056637689938';
const AKTIFLIK_ROLE_ID = '1500135055207567590';
const AKTIFLIK_PENALTY_CHANNEL_ID = '1500545923816624259';
const PENALTY_ROLE_1 = '1500509508051402923';
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

    try {
      await penaltyChannel.send({
        content: `<@${member.id}> aktiflik tiklememe nedeniyle ${roleText} rolunu aldi. (ust uste: ${status.consecutive_misses})`,
        allowedMentions: { users: [member.id] },
      });
    } catch (sendErr) {
      console.error('Uyari kanali mesaj gönderme hatasi:', sendErr);
    }
  }
}

export const finalizeAktiflikSession = async (
  client: BotClient,
  guild: Guild,
  sessionId: number,
  messageId: string,
  channelId: string
): Promise<void> => {
  console.log(`[Aktiflik] finalizeAktiflikSession basladi. Session: ${sessionId}, Message: ${messageId}`);
  const session = client.db.getAktiflikSessionByMessageId(messageId);
  if (!session || session.id !== sessionId || session.active !== 1) {
    console.log(`[Aktiflik] Oturum bulunamadi veya zaten kapali. Active: ${session?.active}`);
    return;
  }

  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !('messages' in channel)) {
    console.log(`[Aktiflik] Kanal bulunamadi: ${channelId}`);
    client.db.closeAktiflikSession(sessionId);
    return;
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    console.log(`[Aktiflik] Mesaj bulunamadi: ${messageId}`);
    client.db.closeAktiflikSession(sessionId);
    return;
  }

  await guild.members.fetch().catch(err => console.error('[Aktiflik] Member fetch hatasi:', err));
  const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
  
  if (!role) {
    console.log(`[Aktiflik] Rol bulunamadi: ${AKTIFLIK_ROLE_ID}`);
  }

  const roleMembers = role ? Array.from(role.members.values()) : [];
  console.log(`[Aktiflik] Roldeki toplam kisi (fetch sonrasi): ${roleMembers.length}`);

  const participants = client.db.getAktiflikSessionParticipants(sessionId);
  const joinedIds = new Set(participants.map((p) => p.id));

  const joinedMembers = roleMembers.filter((m) => joinedIds.has(m.id));
  const missedMembers = roleMembers.filter((m) => !joinedIds.has(m.id));

  console.log(`[Aktiflik] Katilan: ${joinedMembers.length}, Katilmayan: ${missedMembers.length}`);

  for (const member of joinedMembers) {
    client.db.markAktiflikJoined(member.id, member.displayName);
  }

  for (const member of missedMembers) {
    console.log(`[Aktiflik] Ceza uygulaniyor: ${member.displayName} (${member.id})`);
    // ensure we await penalty to handle them one by one
    await applyPenaltyForMissedMember(member, client, guild, AKTIFLIK_PENALTY_CHANNEL_ID).catch(err => {
      console.error(`[Aktiflik] Ceza uygulama hatasi (${member.displayName}):`, err);
    });
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
        .setName('saat')
        .setDescription('Kac saat aktiflik acik kalsin?')
        .setMinValue(1)
        .setMaxValue(24)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(8), // Administrator

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;
      const hours = interaction.options.getInteger('saat', true);
      const durationMs = hours * 60 * 60 * 1000;

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
      const roleMembers = role ? role.members.filter(m => m.roles.cache.has(AKTIFLIK_ROLE_ID)) : null;
      const roleMembersCount = roleMembers ? roleMembers.size : 0;

      const embed = new EmbedBuilder()
        .setTitle('✅ Aktiflik Kontrolü')
        .setDescription(`Aşağıdaki butona tıklayarak aktifliğinizi onaylayın!\n\n**Süre:** ${hours} Saat`)
        .setColor('Green')
        .addFields({ name: '📊 Katilim', value: `0/${roleMembersCount}`, inline: false })
        .setFooter({ text: `Aktiflik kontrolü — ${turkishDate()}` });

      const button = new ButtonBuilder()
        .setCustomId('aktiflik_onayla_temp')
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const message = await channel.send({
        embeds: [embed],
        components: [row],
      });

      // Send DM to members of the role
      if (roleMembers) {
        for (const [id, member] of roleMembers) {
          if (member.user.bot) continue;
          try {
            await member.send('aktiflik tikle yoksa sana bb');
          } catch (dmErr) {
            // Silently ignore DM errors
          }
        }
      }

      const sessionId = client.db.createAktiflikSession(
        message.id,
        message.channelId,
        AKTIFLIK_ROLE_ID,
        hours * 3600, // seconds
        interaction.user.id
      );

      const activeButton = new ButtonBuilder()
        .setCustomId(`aktiflik_onayla_${sessionId}`)
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);
      const activeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(activeButton);
      await message.edit({ components: [activeRow] });

      // Start timeout for auto-close
      console.log(`[Aktiflik] Zamanlayici kuruldu: ${hours} saat (${durationMs} ms)`);
      setTimeout(() => {
        console.log(`[Aktiflik] Otomatik kapatma tetiklendi. Session: ${sessionId}`);
        finalizeAktiflikSession(client, guild, sessionId, message.id, message.channelId)
          .catch((error) => console.error('Aktiflik kapatma hatasi:', error));
      }, durationMs);

      client.db.addBotLog(
        'aktiflik_kontrolu_baslatildi',
        interaction.user.id,
        interaction.user.username
      );

      await interaction.editReply({
        content: `✅ Aktiflik kontrolü başlatıldı! Süre: ${hours} Saat.`,
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
