import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const INGAME_CHANNEL_ID = '1500135056637689939';
const YETKILI_ROLE_ID = '1500135055207567590'; // High rank role

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ingame')
    .setDescription('In-game oturumu başlatır')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
        });
        return;
      }

      // Check if there's already an active session
      const activeSession = client.db.getActiveIngameSession();
      if (activeSession) {
        await interaction.editReply({
          content: '⚠️ Zaten aktif bir in-game oturumu var. Lütfen onu kapatın.',
        });
        return;
      }

      const channel = guild.channels.cache.get(INGAME_CHANNEL_ID);
      if (!channel || !('send' in channel)) {
        await interaction.editReply({
          content: '❌ In-game kanalı bulunamadı.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🎮 In-Game Oturumu')
        .setDescription('Oyuna girmek için aşağıdaki butona tıklayın! (Maksimum 20 kişi)')
        .setColor('Blue')
        .addFields(
          {
            name: '👥 Katılımcılar',
            value: 'Katılımcı yok',
            inline: false,
          },
          {
            name: '📊 Toplam',
            value: 'Katılımcı Sayısı: 0/20',
            inline: false,
          }
        );

      const joinButton = new ButtonBuilder()
        .setCustomId('ingame_katil_[ID]') // Will be replaced after message creation
        .setLabel('🎮 Katıl')
        .setStyle(ButtonStyle.Success);

      const leaveButton = new ButtonBuilder()
        .setCustomId('ingame_ayril_[ID]') // Will be replaced after message creation
        .setLabel('❌ Ayrıl')
        .setStyle(ButtonStyle.Danger);

      // Send initial message without custom IDs (will be updated after getting message ID)
      const joinButtonTemp = new ButtonBuilder()
        .setCustomId('temp_join')
        .setLabel('🎮 Katıl')
        .setStyle(ButtonStyle.Success);

      const leaveButtonTemp = new ButtonBuilder()
        .setCustomId('temp_leave')
        .setLabel('❌ Ayrıl')
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButtonTemp, leaveButtonTemp);

      const message = await channel.send({
        // content: '@everyone', // TODO: Re-enable @everyone mention later
        embeds: [embed],
        components: [row],
        // allowedMentions: { parse: ['everyone'] },
      });

      // Create session in database
      const sessionId = client.db.createIngameSession(message.id, channel.id, interaction.user.id);

      // Update buttons with correct custom IDs
      const joinButtonReal = new ButtonBuilder()
        .setCustomId(`ingame_katil_${sessionId}`)
        .setLabel('🎮 Katıl')
        .setStyle(ButtonStyle.Success);

      const leaveButtonReal = new ButtonBuilder()
        .setCustomId(`ingame_ayril_${sessionId}`)
        .setLabel('❌ Ayrıl')
        .setStyle(ButtonStyle.Danger);

      const rowReal = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButtonReal, leaveButtonReal);

      await message.edit({
        components: [rowReal],
      });

      client.db.addBotLog(
        'ingame_oturumu_baslatildi',
        interaction.user.id,
        interaction.user.username
      );

      await interaction.editReply({
        content: `✅ In-game oturumu başlatıldı! (Session ID: ${sessionId})`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('In-game komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
