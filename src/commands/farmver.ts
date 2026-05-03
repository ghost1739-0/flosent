import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';

const FARMVER_CHANNEL_ID = '1500452813942030407';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('farmver')
    .setDescription('Farm miktarını kaydeder')
    .addIntegerOption((option) =>
      option
        .setName('miktar')
        .setDescription('Kaydedilecek farm miktarı')
        .setRequired(true)
        .setMinValue(1)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const client = interaction.client as BotClient;
      const amount = interaction.options.getInteger('miktar', true);

      // Check if command is used in correct channel
      if (interaction.channelId !== FARMVER_CHANNEL_ID) {
        await interaction.reply({
          content: `❌ Bu komut sadece <#${FARMVER_CHANNEL_ID}> kanalında kullanılabilir.`,
          ephemeral: true,
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        await interaction.reply({
          content: '❌ Miktar 0 dan büyük olmalıdır.',
          ephemeral: true,
        });
        return;
      }

      // Add farm log
      client.db.addFarmLog(interaction.user.id, interaction.user.username, amount);
      client.db.addBotLog('farm_ver', interaction.user.id, interaction.user.username, `Miktar: ${amount}`);

      await interaction.reply({
        content: `✅ ${amount} farm başarıyla kaydedildi!`,
        ephemeral: true,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Farmver komutu hatası:', error);
      await interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true,
      });
    }
  },
};

export default command;
