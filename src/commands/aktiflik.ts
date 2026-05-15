import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  Guild,
  GuildMember,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const AKTIFLIK_CHANNEL_ID = '1500135056637689938';
const AKTIFLIK_ROLE_ID = '1500135055207567590';
const AKTIFLIK_PANEL_CHANNEL_ID = '1500135056440819836';
const AKTIFLIK_PANEL_PERM_ROLE_ID = '1500135055148843147';

type EmbedField = {
  name: string;
  value: string;
  inline?: boolean;
};

function formatMemberLines(members: GuildMember[], icon: string): string {
  if (!members.length) {
    return 'Yok';
  }

  const lines: string[] = [];
  for (const member of members) {
    const displayName = member.displayName || member.user.username;
    const line = `${icon} ${displayName}`;
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
    lines.push(`... ve ${members.length - lines.length} kişi daha`);
  }

  return lines.join('\n');
}

export function buildMentionFields(members: GuildMember[], baseName: string, icon: string): EmbedField[] {
  if (!members.length) {
    return [
      {
        name: baseName,
        value: 'Yok',
        inline: false,
      },
    ];
  }

  const fields: EmbedField[] = [];
  let currentLines: string[] = [];
  let currentLength = 0;

  for (const member of members) {
    const line = `${icon} <@${member.id}>`;
    const lineLength = line.length + 1;

    if (currentLines.length > 0 && currentLength + lineLength > 900) {
      fields.push({
        name: fields.length === 0 ? baseName : `${baseName} (devam ${fields.length + 1})`,
        value: currentLines.join('\n'),
        inline: false,
      });
      currentLines = [];
      currentLength = 0;
    }

    currentLines.push(line);
    currentLength += lineLength;
  }

  if (currentLines.length > 0) {
    fields.push({
      name: fields.length === 0 ? baseName : `${baseName} (devam ${fields.length + 1})`,
      value: currentLines.join('\n'),
      inline: false,
    });
  }

  return fields;
}

function buildAktiflikPanelEmbed(
  sessionId: number,
  missedMembers: GuildMember[],
  joinedMembers: GuildMember[],
  roleMembersCount: number
): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('✅ Aktiflik Kapatildi - Perm Paneli')
    .setDescription('Katılmayanlardan perm çekmek için aşağıdaki butona bas.')
    .setColor('Orange')
    .addFields(
      {
        name: '📊 Katılım Özeti',
        value: `Toplam: **${roleMembersCount}**\nKatılan: **${joinedMembers.length}**\nKatılmayan: **${missedMembers.length}**`,
        inline: false,
      },
      ...buildMentionFields(missedMembers, `❌ Katılmayanlar (${missedMembers.length})`, '❌')
    )
    .setFooter({ text: `Oturum: ${sessionId}` });
}

export async function sendAktiflikPanelMessage(
  client: BotClient,
  guild: Guild,
  sessionId: number,
  missedMembers: GuildMember[],
  joinedMembers: GuildMember[],
  roleMembersCount: number
): Promise<void> {
  const panelChannel = (await client.channels.fetch(AKTIFLIK_PANEL_CHANNEL_ID).catch(() => null))
    ?? guild.channels.cache.get(AKTIFLIK_PANEL_CHANNEL_ID)
    ?? await guild.channels.fetch(AKTIFLIK_PANEL_CHANNEL_ID).catch(() => null);

  if (!panelChannel || !('send' in panelChannel)) {
    console.error(`[Aktiflik Panel] ❌ KANAL BULUNAMADI: ${AKTIFLIK_PANEL_CHANNEL_ID}`);
    return;
  }

  const botMember = guild.members.me ?? await guild.members.fetchMe().catch(() => null);
  if (botMember && 'permissionsFor' in panelChannel) {
    const permissions = panelChannel.permissionsFor(botMember);
    if (!permissions?.has(PermissionFlagsBits.ViewChannel)) {
      console.error(`[Aktiflik Panel] ❌ View Channel izni yok: ${AKTIFLIK_PANEL_CHANNEL_ID}`);
    }
    if (!permissions?.has(PermissionFlagsBits.SendMessages)) {
      console.error(`[Aktiflik Panel] ❌ Send Messages izni yok: ${AKTIFLIK_PANEL_CHANNEL_ID}`);
    }
    if (!permissions?.has(PermissionFlagsBits.EmbedLinks)) {
      console.error(`[Aktiflik Panel] ⚠️ Embed Links izni yok: ${AKTIFLIK_PANEL_CHANNEL_ID}`);
    }
  }

  const panelEmbed = buildAktiflikPanelEmbed(sessionId, missedMembers, joinedMembers, roleMembersCount);

  const permButton = new ButtonBuilder()
    .setCustomId(`aktiflik_permcek_${sessionId}`)
    .setLabel('🎭 Permleri Çek')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(permButton);

  try {
    const mentionIds = missedMembers.map((member) => member.id);
    console.log(`[Aktiflik Panel] Mention IDs: ${mentionIds.join(', ')}`);

    await panelChannel.send({
      embeds: [panelEmbed],
      components: [row],
      allowedMentions: { parse: ['users'], users: mentionIds },
    });

    console.log(`[Aktiflik Panel] Panel mesajı gönderildi. Session ${sessionId}, Katılmayan: ${missedMembers.length}`);
  } catch (error) {
    console.error(`[Aktiflik Panel] Hata oluştu:`, error);

    try {
      const mentionIds = missedMembers.map((member) => member.id);
      const panelEmbedFallback = buildAktiflikPanelEmbed(sessionId, missedMembers, joinedMembers, roleMembersCount);

      await panelChannel.send({
        embeds: [panelEmbedFallback],
        components: [row],
        allowedMentions: { parse: ['users'], users: mentionIds },
      });

      console.log(`[Aktiflik Panel] Panel mesajı fallback ile gönderildi. Session ${sessionId}`);
    } catch (fallbackError) {
      console.error(`[Aktiflik Panel] Panel fallback da başarısız oldu:`, fallbackError);
    }
  }
}

export const finalizeAktiflikSession = async (
  client: BotClient,
  guild: Guild,
  sessionId: number,
  messageId: string,
  channelId: string,
  allowInactive: boolean = false
): Promise<void> => {
  console.log(`[Aktiflik] finalizeAktiflikSession basladi. Session: ${sessionId}, Message: ${messageId}`);
  const session = await client.db.getAktiflikSessionByMessageId(messageId);
  if (!session || session.id !== sessionId || (!allowInactive && session.active !== 1)) {
    console.log(`[Aktiflik] Oturum bulunamadi veya zaten kapali. Active: ${session?.active}`);
    return;
  }

  await client.db.closeAktiflikSession(sessionId);

  const channel = guild.channels.cache.get(channelId) ?? await guild.channels.fetch(channelId).catch(() => null);
  if (!channel || !('messages' in channel)) {
    console.log(`[Aktiflik] Kanal bulunamadi: ${channelId}`);
    return;
  }

  const message = await channel.messages.fetch(messageId).catch(() => null);
  if (!message) {
    console.log(`[Aktiflik] Mesaj bulunamadi: ${messageId}`);
    return;
  }

  await guild.members.fetch().catch(err => console.error('[Aktiflik] Member fetch hatasi:', err));
  const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
  
  if (!role) {
    console.log(`[Aktiflik] Rol bulunamadi: ${AKTIFLIK_ROLE_ID}`);
  }

  const roleMembers = role ? Array.from(role.members.values()) : [];
  console.log(`[Aktiflik] Roldeki toplam kisi (fetch sonrasi): ${roleMembers.length}`);

  const participants = await client.db.getAktiflikSessionParticipants(sessionId);
  const joinedIds = new Set(participants.map((p: { id: string }) => p.id));

  const joinedMembers = roleMembers.filter((m) => joinedIds.has(m.id));
  const missedMembers = roleMembers.filter((m) => !joinedIds.has(m.id));

  console.log(`[Aktiflik] Katilan: ${joinedMembers.length}, Katilmayan: ${missedMembers.length}`);

  for (const member of joinedMembers) {
    await client.db.markAktiflikJoined(member.id, member.displayName);
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
        name: `❌ Katılmayanlar (${missedMembers.length})`,
        value: missedMembers.length ? formatMemberMentionLines(missedMembers, '❌') : 'Yok',
        inline: false,
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

  try {
    await message.edit({
      content: null,
      embeds: [closedEmbed],
      components: [row],
    });
  } catch (error) {
    console.error('[Aktiflik] Kapanış mesajı güncellenemedi:', error);
  }

  try {
    await sendAktiflikPanelMessage(client, guild, sessionId, missedMembers, joinedMembers, roleMembers.length);
  } catch (error) {
    console.error('[Aktiflik] Panel mesajı gönderilemedi:', error);
  }

  await client.db.addBotLog(
    'aktiflik_otomatik_kapandi',
    'SYSTEM',
    'SYSTEM',
    `Oturum ${sessionId} otomatik kapatıldı. Katılmayan: ${missedMembers.length}`
  );
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aktiflik')
    .setDescription('Aktiflik kontrolü başlatır')
    .addIntegerOption((option) =>
      option
        .setName('saat')
        .setDescription('Kaç saat aktiflik açık kalsın?')
        .setMinValue(1)
        .setMaxValue(96)
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

      // Check if user has the required role for aktiflik
      const member = interaction.member;
      if (!member || !('roles' in member)) {
        await interaction.editReply({
          content: '❌ Üye bilgileri alınamadı.',
        });
        return;
      }

      if (!(member.roles as any).cache.has(AKTIFLIK_ROLE_ID)) {
        await interaction.editReply({
          content: '❌ Bu komutu kullanmak için gerekli role sahip değilsiniz. Sadece <@&' + AKTIFLIK_ROLE_ID + '> sahip üyeler bu komutu çalıştırabilir.',
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

      const sessionId = await client.db.createAktiflikSession(
        message.id,
        message.channelId,
        AKTIFLIK_ROLE_ID,
        hours * 3600,
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

      await client.db.addBotLog(
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
