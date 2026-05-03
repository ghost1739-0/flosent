import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate, formatNumber } from '../utils/helpers';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('farm')
    .setDescription('Farm leaderboardını gösterir'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const client = interaction.client as BotClient;
      const leaderboard = client.db.getFarmLeaderboard();

      if (leaderboard.length === 0) {
        await interaction.reply({
          content: '📭 Henüz farm verisi yok.',
          ephemeral: true,
        });
        return;
      }

      const description = leaderboard
        .slice(0, 25)
        .map(
          (entry, index) =>
            `**${index + 1}.** ${entry.username} - ${formatNumber(entry.total_amount)} 🌾`
        )
        .join('\n');

      const embed = new EmbedBuilder()
        .setTitle('🌾 Farm Listesi')
        .setDescription(description)
        .setFooter({ text: `Son güncelleme: ${turkishDate()}` })
        .setColor('Yellow');

      await interaction.reply({
        embeds: [embed],
        ephemeral: false,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Farm komutu hatası:', error);
      await interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true,
      });
    }
  },
};

export default command;
