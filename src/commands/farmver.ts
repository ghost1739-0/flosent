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
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const amount = interaction.options.getInteger('miktar', true);

      // Check if command is used in correct channel
      if (interaction.channelId !== FARMVER_CHANNEL_ID) {
        await interaction.editReply({
          content: `❌ Bu komut sadece <#${FARMVER_CHANNEL_ID}> kanalında kullanılabilir.`,
        });
        return;
      }

      // Validate amount
      if (amount <= 0) {
        await interaction.editReply({
          content: '❌ Miktar 0 dan büyük olmalıdır.',
        });
        return;
      }

      // Add farm log
      client.db.addFarmLog(interaction.user.id, interaction.user.username, amount);
      client.db.addBotLog('farm_ver', interaction.user.id, interaction.user.username, `Miktar: ${amount}`);

      await interaction.editReply({
        content: `✅ ${amount} farm başarıyla kaydedildi!`,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Farmver komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
