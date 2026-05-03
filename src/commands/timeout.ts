import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate, formatTimeout } from '../utils/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Bir kullanıcıya timeout uygulanır')
    .addUserOption((option) => option.setName('kullanici').setDescription('Timeout alacak kullanıcı').setRequired(true))
    .addIntegerOption((option) =>
      option
        .setName('sure')
        .setDescription('Timeout süresi (saniye). Max: 2419200 (28 gün)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(2419200)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator | PermissionFlagsBits.ModerateMembers),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const client = interaction.client as BotClient;
      const user = interaction.options.getUser('kullanici', true);
      const seconds = interaction.options.getInteger('sure', true);
      const guild = interaction.guild;

      if (!guild) {
        await interaction.reply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
          ephemeral: true,
        });
        return;
      }

      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) {
        await interaction.reply({
          content: '❌ Kullanıcı sunucuda değil.',
          ephemeral: true,
        });
        return;
      }

      // Apply timeout
      await member.timeout(seconds * 1000);

      // Try to DM user
      try {
        await user.send(`⏱️ ${formatTimeout(seconds)} saniyelik timeout aldınız.`);
      } catch {
        // Silently fail if user has DMs closed
      }

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setTitle('⏱️ Timeout Uygulandı')
        .addFields(
          { name: 'Kullanıcı', value: user.username, inline: true },
          { name: 'Süre', value: `${seconds} saniye (${formatTimeout(seconds)})`, inline: true },
          { name: 'Uygulayan', value: interaction.user.username, inline: true },
          { name: 'Tarih', value: turkishDate(), inline: true }
        )
        .setColor('Orange');

      const channel = interaction.channel;
      if (channel && 'send' in channel) {
        await channel.send({ embeds: [embed] });
      }

      client.db.addBotLog('timeout', user.id, user.username, `Süre: ${seconds} saniye`);

      await interaction.reply({
        content: '✅ Timeout başarıyla uygulandı!',
        ephemeral: true,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Timeout komutu hatası:', error);
      await interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true,
      });
    }
  },
};

export default command;
