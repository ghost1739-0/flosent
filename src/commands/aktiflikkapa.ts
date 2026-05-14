import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { finalizeAktiflikSession } from './aktiflik';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('aktiflikkapa')
    .setDescription('Aktif olan aktiflik kontrolünü anında kapatır')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({
          content: '❌ Bu komut sunucuda kullanılabilir.',
        });
        return;
      }

      // Find active sessions
      const activeSessions = await client.db.getActiveAktiflikSessions();
      console.log(`[AktiflikKapa] Aktif oturumlar sorgulandi. Sayi: ${activeSessions?.length || 0}`);
      
      if (!activeSessions || activeSessions.length === 0) {
        // Log additional info to see why it's failing
        console.log('[AktiflikKapa] Hic aktif oturum bulunamadi (active=1 olan kayit yok)');
        await interaction.editReply({
          content: '⚠️ Şu anda aktif bir aktiflik kontrolü bulunmuyor.',
        });
        return;
      }

      // Force close the newest session
      const activeSession = activeSessions[activeSessions.length - 1];
      console.log(`[AktiflikKapa] Oturum kapatiliyor: ID=${activeSession.id}, MsgID=${activeSession.message_id}`);
      
      await finalizeAktiflikSession(
        client,
        guild,
        activeSession.id,
        activeSession.message_id,
        activeSession.channel_id
      );

      await interaction.editReply({
        content: '✅ Aktiflik kontrolü başarıyla kapatıldı ve sonuçlar açıklandı.',
      });

      await client.db.addBotLog(
        'aktiflik_manuel_kapatildi',
        interaction.user.id,
        interaction.user.username
      );

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('aktiflikkapa komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
