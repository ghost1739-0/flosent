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
    .setName('kick')
    .setDescription('Bir kullanıcıyı sunucudan atar')
    .addUserOption((option) => option.setName('kullanici').setDescription('Atılacak kullanıcı').setRequired(true))
    .addStringOption((option) =>
      option.setName('sebep').setDescription('Kick sebebi').setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.KickMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const user = interaction.options.getUser('kullanici', true);
      const reason = interaction.options.getString('sebep') || 'Sebep belirtilmedi';
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
        });
        return;
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.editReply({
          content: '❌ Kullanıcı sunucuda değil.',
        });
        return;
      }

      // Try to DM user before kicking
      try {
        await user.send(`👢 ${guild.name} sunucusundan atıldınız. Sebep: ${reason}`);
      } catch {
        // Silently fail if user has DMs closed
      }

      // Kick from Discord
      await member.kick(reason);

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('👢 Kullanıcı Kicklendi')
        .addFields(
          { name: 'Kullanıcı', value: user.username, inline: true },
          { name: 'Sebep', value: reason, inline: true },
          { name: 'Atan', value: interaction.user.username, inline: true },
          { name: 'Tarih', value: turkishDate(), inline: true }
        )
        .setColor('Orange');

      const channel = interaction.channel;
      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed] });
      }

      client.db.addBotLog('kick', user.id, user.username, `Sebep: ${reason}`);

      await interaction.editReply({
        content: '✅ Kullanıcı başarıyla atıldı!',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Kick komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
