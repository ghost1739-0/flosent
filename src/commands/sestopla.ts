import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  VoiceChannel,
  StageChannel,
} from 'discord.js';
import type { BotCommand } from '../types';

const TARGET_VOICE_CHANNEL_ID = '1500135057078223027';
const TARGET_ROLE_ID = '1504751366826885230';
const SOURCE_VOICE_CHANNEL_IDS = [
  '1500867578669695066',
  '1500869221930893583',
];

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

      const targetRole = guild.roles.cache.get(TARGET_ROLE_ID);
      if (!targetRole) {
        await interaction.editReply({ content: '❌ Hedef rol bulunamadı.' });
        return;
      }

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
      const eligibleMembers = new Map<string, typeof targetRole.members extends Map<string, infer T> ? T : never>();

      for (const member of targetRole.members.values()) {
        if (!member.user.bot) {
          eligibleMembers.set(member.id, member);
        }
      }

      for (const sourceChannelId of SOURCE_VOICE_CHANNEL_IDS) {
        const sourceChannel = guild.channels.cache.get(sourceChannelId);
        if (!sourceChannel || !(sourceChannel instanceof VoiceChannel || sourceChannel instanceof StageChannel)) {
          continue;
        }

        for (const member of sourceChannel.members.values()) {
          if (member.user.bot || !member.roles.cache.has(TARGET_ROLE_ID)) {
            continue;
          }

          eligibleMembers.set(member.id, member);
        }
      }

      for (const member of eligibleMembers.values()) {
        const voiceChannelId = member.voice.channelId;
        if (!voiceChannelId || voiceChannelId === TARGET_VOICE_CHANNEL_ID) {
          continue;
        }

        try {
          await member.voice.setChannel(targetChannel.id);
          movedCount++;
        } catch (err) {
          console.error(`Üye taşıma hatası (${member.displayName}):`, err);
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
