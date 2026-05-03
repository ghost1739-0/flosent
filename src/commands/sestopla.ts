import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  VoiceChannel,
  StageChannel,
} from 'discord.js';
import type { BotCommand } from '../types';

const TARGET_VOICE_CHANNEL_ID = '1500135057078223027';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('sestopla')
    .setDescription('Tüm sesli kanallardaki kullanıcıları tek kanala toplar ve mikrofonlarını kapatır.')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const guild = interaction.guild;

      if (!guild) {
        await interaction.editReply({ content: '❌ Bu komut sadece sunucularda kullanılabilir.' });
        return;
      }

      const targetChannel = guild.channels.cache.get(TARGET_VOICE_CHANNEL_ID);
      if (!targetChannel || !(targetChannel instanceof VoiceChannel || targetChannel instanceof StageChannel)) {
        await interaction.editReply({ content: '❌ Hedef ses kanalı bulunamadı veya geçerli bir ses kanalı değil.' });
        return;
      }

      const voiceStates = guild.voiceStates.cache;
      let movedCount = 0;
      let mutedCount = 0;

      for (const [memberId, voiceState] of voiceStates) {
        const member = voiceState.member;
        if (!member) continue;

        try {
          // Move member to target channel if not already there
          if (voiceState.channelId && voiceState.channelId !== TARGET_VOICE_CHANNEL_ID) {
            await voiceState.setChannel(TARGET_VOICE_CHANNEL_ID as any);
            movedCount++;
          }

          // Mute everyone regardless of roles
          if (voiceState.channelId && !voiceState.serverMute) {
            await voiceState.setMute(true, 'Sestopla komutu ile mikrofon kapatıldı.');
            mutedCount++;
          }
        } catch (err) {
          console.error(`Üye taşıma/susturma hatası (${member.displayName}):`, err);
        }
      }

      await interaction.editReply({
        content: `✅ İşlem tamamlandı!\n- **${movedCount}** kişi hedef kanala taşındı.\n- **${mutedCount}** kişinin mikrofonu kapatıldı.`,
      });

    } catch (error) {
      console.error('Sestopla komutu hatası:', error);
      await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu.' });
    }
  },
};

export default command;
