import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { BotCommand } from '../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Botun ping değerini kontrol et'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    console.log('[PING] Komut çalıştırıldı');
    try {
      console.log('[PING] deferReply çağrılıyor...');
      await interaction.deferReply();
      console.log('[PING] deferReply başarılı');
      
      await interaction.editReply({
        content: `🏓 Pong! ${interaction.client.ws.ping}ms`,
      });
      console.log('[PING] Yanıt gönderildi');
    } catch (error) {
      console.error('[PING] Hata:', error);
    }
  },
};

export default command;
