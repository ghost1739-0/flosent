import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const AKTIFLIK_CHANNEL_ID = '1500137490042851450';
const AKTIFLIK_ROLE_ID = '1500135055207567590';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aktiflik')
    .setDescription('Aktiflik kontrolü başlatır')
    .setDefaultMemberPermissions(8), // Administrator

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

      const channel = guild.channels.cache.get(AKTIFLIK_CHANNEL_ID);
      if (!channel || !('send' in channel)) {
        await interaction.editReply({
          content: '❌ Aktiflik kanalı bulunamadı.',
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('✅ Aktiflik Kontrolü')
        .setDescription('Aşağıdaki butona tıklayarak aktifliğinizi onaylayın!')
        .setColor('Green')
        .setFooter({ text: `Aktiflik kontrolü — ${turkishDate()}` });

      const button = new ButtonBuilder()
        .setCustomId('aktiflik_onayla')
        .setLabel('✅ Aktifliğimi Onayla')
        .setStyle(ButtonStyle.Success);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

      const message = await channel.send({
        // content: '@everyone', // TODO: Re-enable @everyone mention later
        embeds: [embed],
        components: [row],
        // allowedMentions: { parse: ['everyone'] },
      });

      // Send DM to all members with AKTIFLIK_ROLE_ID
      const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
      if (role) {
        const members = role.members;
        for (const [, member] of members) {
          try {
            await member.send(
              '📢 Aktiflik kontrolü başladı! Aktifliğini onaylamak için sunucuya gel ve butona tıkla.'
            );
          } catch {
            // Silently skip if DM fails
          }
        }
      }

      client.db.addBotLog(
        'aktiflik_kontrolu_baslatildi',
        interaction.user.id,
        interaction.user.username
      );

      await interaction.editReply({
        content: '✅ Aktiflik kontrolü başlatıldı!',
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
