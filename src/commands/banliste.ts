import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  ButtonBuilder,
  ActionRowBuilder,
  ButtonStyle,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('banliste')
    .setDescription('Aktif ban listesini gösterir')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const bans = await client.db.getActiveBans();

      if (bans.length === 0) {
        await interaction.editReply({
          content: '✅ Aktif ban bulunmuyor.',
        });
        return;
      }

      const itemsPerPage = 5;
      const totalPages = Math.ceil(bans.length / itemsPerPage);
      const currentPage = 1;
      const startIdx = 0;
      const endIdx = itemsPerPage;
      const pageBans = bans.slice(startIdx, endIdx);

      let description = pageBans
        .map(
          (ban) =>
            `**${ban.username}** - *${ban.reason}*\n└─ Banlayan: ${ban.banned_by} | ${new Date(ban.banned_at).toLocaleString(
              'tr-TR'
            )}`
        )
        .join('\n\n');

      const embed = new EmbedBuilder()
        .setTitle('🔨 Ban Listesi')
        .setDescription(description)
        .setFooter({ text: `Sayfa ${currentPage}/${totalPages}` })
        .setColor('Red');

      const prevButton = new ButtonBuilder()
        .setCustomId(`ban_page_prev_${interaction.user.id}_${currentPage}`)
        .setLabel('◀️ Önceki')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === 1);

      const nextButton = new ButtonBuilder()
        .setCustomId(`ban_page_next_${interaction.user.id}_${currentPage}`)
        .setLabel('Sonraki ▶️')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(currentPage === totalPages);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

      await interaction.editReply({
        embeds: [embed],
        components: totalPages > 1 ? [row] : [],
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Banliste komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
