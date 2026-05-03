import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotCommand } from '../types';

const TARGET_CHANNEL_ID = '1500135057078223023';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('rauch')
    .setDescription('Belirli kanalda bir mesaj gönderir'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      if (interaction.channelId !== TARGET_CHANNEL_ID) {
        await interaction.reply({
          content: '❌ Bu komut sadece belirlenen kanalda kullanılabilir.',
          ephemeral: true,
        });
        return;
      }

      await interaction.reply({
        content: 'ben kokuyorum',
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Rauch komutu hatası:', error);

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply({ content: '❌ Bir hata oluştu.' });
      } else {
        await interaction.reply({ content: '❌ Bir hata oluştu.', ephemeral: true });
      }
    }
  },
};

export default command;