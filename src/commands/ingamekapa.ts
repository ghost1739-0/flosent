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
    .setName('ingamekapa')
    .setDescription('Aktif in-game oturumunu kapatır')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({ content: '❌ Bu komut sunucuda kullanılabilir.' });
        return;
      }

      const session = client.db.getActiveIngameSession();
      if (!session) {
        await interaction.editReply({ content: '✅ Aktif in-game oturumu bulunmuyor.' });
        return;
      }

      // Close in DB
      client.db.closeIngameSession(session.id);
      client.db.addBotLog('ingame_oturumu_kapatildi', interaction.user.id, interaction.user.username, `Session kapatıldı id=${session.id}`);

      // Try to edit the original message to mark closed and remove buttons
      try {
        const channel = await client.channels.fetch(session.channel_id).catch(() => null) as any;
        if (channel && 'messages' in channel) {
          const msg = await channel.messages.fetch(session.message_id).catch(() => null);
          if (msg) {
            const currentEmbed = msg.embeds[0];
            let embed: EmbedBuilder;
            if (currentEmbed) {
              embed = EmbedBuilder.from(currentEmbed).setColor('DarkGrey');
              // add a field to indicate closed status
              embed.addFields({ name: '⛔ Durum', value: 'Oturum kapatıldı', inline: false });
            } else {
              embed = new EmbedBuilder().setTitle('🎮 In-Game Oturumu').setDescription('Oturum kapatıldı').setColor('DarkGrey');
            }

            await msg.edit({ embeds: [embed], components: [] }).catch(() => null);
          }
        }
      } catch {
        // ignore errors while trying to edit message
      }

      await interaction.editReply({ content: `✅ In-game oturumu kapatıldı. (Session ID: ${session.id}) — ${turkishDate()}` });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Ingame kapama hatası:', error);
      try {
        await interaction.editReply({ content: '❌ Bir hata oluştu.' });
      } catch {
        // ignore
      }
    }
  },
};

export default command;
