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
      await interaction.deferReply({ ephemeral: true });

      if (interaction.channelId !== TARGET_CHANNEL_ID) {
        await interaction.editReply({
          content: '❌ Bu komut sadece belirlenen kanalda kullanılabilir.',
        });
        return;
      }

      const targetChannel = interaction.guild?.channels.cache.get(TARGET_CHANNEL_ID);
      if (!targetChannel || !('send' in targetChannel)) {
        await interaction.editReply({ content: '❌ Hedef kanal bulunamadı.' });
        return;
      }

      const messageChannel = targetChannel as { send: (content: string) => Promise<unknown> };
      await messageChannel.send('taşaklarım kokuyor');

      await interaction.editReply({ content: '✅ Mesaj gönderildi.' });
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