import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bir kullanıcıyı sunucudan banlar')
    .addUserOption((option) => option.setName('kullanici').setDescription('Banlanacak kullanıcı').setRequired(true))
    .addStringOption((option) => option.setName('sebep').setDescription('Ban sebebi').setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const user = interaction.options.getUser('kullanici', true);
      const reason = interaction.options.getString('sebep', true);
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
        });
        return;
      }

      // Check if user is already banned
      if (await client.db.isBanned(user.id)) {
        await interaction.editReply({
          content: '⚠️ Bu kullanıcı zaten banlı.',
        });
        return;
      }

      // Try to DM user before banning
      try {
        await user.send(`🔨 ${guild.name} sunucusundan banlandınız. Sebep: ${reason}`);
      } catch {
        // Silently fail if user has DMs closed
      }

      // Add to database
      await client.db.addBan(user.id, user.username, reason, interaction.user.username);

      // Ban from Discord
      try {
        await guild.members.ban(user.id, { reason });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Discord ban hatası:', error);
      }

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('🔨 Kullanıcı Banlandı')
        .addFields(
          { name: 'Kullanıcı', value: `${user.username}`, inline: true },
          { name: 'Sebep', value: reason, inline: true },
          { name: 'Banlayan', value: interaction.user.username, inline: true },
          { name: 'Tarih', value: turkishDate(), inline: true }
        )
        .setColor('Red');

      const channel = interaction.channel;
      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed] });
      }

      await client.db.addBotLog('ban', user.id, user.username, `Sebep: ${reason}`);

      await interaction.editReply({
        content: '✅ Kullanıcı başarıyla banlandı!',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Ban komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
