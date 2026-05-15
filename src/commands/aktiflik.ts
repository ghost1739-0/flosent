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
const AKTIFLIK_PANEL_CHANNEL_ID = '1500135056440819836';
const AKTIFLIK_PANEL_PERM_ROLE_ID = '1500135055148843147';

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

async function sendAktiflikPanelMessage(
  client: BotClient,
  guild: Guild,
  sessionId: number,
  missedMembers: GuildMember[],
  joinedMembers: GuildMember[],
  roleMembersCount: number
): Promise<void> {
  const panelChannel = guild.channels.cache.get(AKTIFLIK_PANEL_CHANNEL_ID)
    ?? await guild.channels.fetch(AKTIFLIK_PANEL_CHANNEL_ID).catch(() => null);

  if (!panelChannel || !('send' in panelChannel)) {
    return;
  }

  const panelEmbed = new EmbedBuilder()
    .setTitle('✅ Aktiflik Kapatildi - Perm Paneli')
    .setDescription('Katılmayanlardan perm çekmek için aşağıdaki butona bas.')
    .setColor('Orange')
    .addFields(
      {
        name: '📊 Katılım Özeti',
        value: `Toplam: **${roleMembersCount}**\nKatılan: **${joinedMembers.length}**\nKatılmayan: **${missedMembers.length}**`,
        inline: false,
      },
      {
        name: `❌ Katılmayanlar (${missedMembers.length})`,
        value: formatMemberLines(missedMembers, '❌'),
        inline: false,
      }
    )
    .setFooter({ text: `Oturum: ${sessionId}` });

  const permButton = new ButtonBuilder()
    .setCustomId(`aktiflik_permcek_${sessionId}`)
    .setLabel('🎭 Permleri Çek')
    .setStyle(ButtonStyle.Danger);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(permButton);

  await panelChannel.send({
    content: missedMembers.length ? missedMembers.map((member) => `<@${member.id}>`).join(' ') : 'Katılmayan yok.',
    embeds: [panelEmbed],
    components: [row],
    allowedMentions: { users: missedMembers.map((member) => member.id) },
  });
}

export const finalizeAktiflikSession = async (
  client: BotClient,
  guild: Guild,
  sessionId: number,
  messageId: string,
  channelId: string
): Promise<void> => {
  console.log(`[Aktiflik] finalizeAktiflikSession basladi. Session: ${sessionId}, Message: ${messageId}`);
  const session = await client.db.getAktiflikSessionByMessageId(messageId);
  if (!session || session.id !== sessionId || session.active !== 1) {
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
  const joinedIds = new Set(participants.map((p) => p.id));

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
  await sendAktiflikPanelMessage(client, guild, sessionId, missedMembers, joinedMembers, roleMembers.length);
}

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aktiflik')
    .setDescription('Aktiflik kontrolü başlatır')
    .addIntegerOption((option) =>
      option
        .setName('saniye')
        .setDescription('Kaç saniye aktiflik açık kalsın?')
        .setMinValue(1)
        .setMaxValue(86400)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(8), // Administrator

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;
      const seconds = interaction.options.getInteger('saniye', true);
      const durationMs = seconds * 1000;

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
        .setDescription(`Aşağıdaki butona tıklayarak aktifliğinizi onaylayın!\n\n**Süre:** ${seconds} Saniye`)
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
        seconds,
        interaction.user.id
      );

      const activeButton = new ButtonBuilder()
        .setCustomId(`aktiflik_onayla_${sessionId}`)
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);
      const activeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(activeButton);
      await message.edit({ components: [activeRow] });

      // Start timeout for auto-close
      console.log(`[Aktiflik] Zamanlayici kuruldu: ${seconds} saniye (${durationMs} ms)`);
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
        content: `✅ Aktiflik kontrolü başlatıldı! Süre: ${seconds} saniye.`,
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
