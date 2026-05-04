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

      // Ensure cache of members is up-to-date
      await guild.members.fetch().catch(() => null);

      const me = guild.members.me;
      if (!me) {
        await interaction.editReply({ content: '❌ Botun sunucu üyesi bilgisi alınamadı.' });
        return;
      }

      const missingPerms: string[] = [];
      if (!me.permissions.has(PermissionFlagsBits.MoveMembers)) missingPerms.push('MoveMembers');
      if (!me.permissions.has(PermissionFlagsBits.MuteMembers)) missingPerms.push('MuteMembers');
      if (missingPerms.length) {
        await interaction.editReply({ content: `❌ Botun gerekli izinleri yok: ${missingPerms.join(', ')}` });
        return;
      }

      let movedCount = 0;
      let mutedCount = 0;

      // Iterate all voice-based channels except the target, then move their members
      const voiceChannels = guild.channels.cache.filter((c) => (c instanceof VoiceChannel || c instanceof StageChannel));
      for (const [chanId, chan] of voiceChannels) {
        // skip the target channel
        if (chanId === TARGET_VOICE_CHANNEL_ID) continue;

        // channel.members is a collection of GuildMembers currently in that voice channel
        for (const [memberId, member] of (chan as any).members) {
          if (!member) continue;
          if (member.user.bot) continue;

          try {
            // move if not already in target
            if (!member.voice || member.voice.channelId !== TARGET_VOICE_CHANNEL_ID) {
              await member.voice.setChannel(TARGET_VOICE_CHANNEL_ID as any);
              movedCount++;
            }

            // mute if not already server muted
            if (member.voice && !member.voice.serverMute) {
              await member.voice.setMute(true, 'Sestopla komutu ile mikrofon kapatıldı.');
              mutedCount++;
            }
          } catch (err) {
            console.error(`Üye taşıma/susturma hatası (${member.displayName}):`, err);
          }
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
