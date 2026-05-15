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
    .setDescription('Seste olan tüm kullanıcıları tek kanala toplar.')
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

      // Ensure cache of members is up-to-date
      await guild.members.fetch().catch(() => null);

      const me = guild.members.me;
      if (!me) {
        await interaction.editReply({ content: '❌ Botun sunucu üyesi bilgisi alınamadı.' });
        return;
      }

      if (!me.permissions.has(PermissionFlagsBits.MoveMembers)) {
        await interaction.editReply({ content: '❌ Botun MoveMembers izni yok.' });
        return;
      }

      let movedCount = 0;
      const voiceChannels = guild.channels.cache.filter(
        (channel): channel is VoiceChannel | StageChannel => channel instanceof VoiceChannel || channel instanceof StageChannel
      );

      for (const voiceChannel of voiceChannels.values()) {
        if (voiceChannel.id === TARGET_VOICE_CHANNEL_ID) {
          continue;
        }

        for (const member of voiceChannel.members.values()) {
          if (member.user.bot) {
            continue;
          }

          try {
            await member.voice.setChannel(targetChannel.id);
            movedCount++;
          } catch (err) {
            console.error(`Üye taşıma hatası (${member.displayName}):`, err);
          }
        }
      }

      await interaction.editReply({
        content: `✅ İşlem tamamlandı!\n- **${movedCount}** kişi hedef kanala taşındı.`,
      });

    } catch (error) {
      console.error('Sestopla komutu hatası:', error);
      await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu.' });
    }
  },
};

export default command;
