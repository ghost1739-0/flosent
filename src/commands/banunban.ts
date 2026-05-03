import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  StringSelectMenuBuilder,
  ActionRowBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('banunban')
    .setDescription('Banlı bir kullanıcıyı sunucuya geri alır')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const client = interaction.client as BotClient;
      const bans = client.db.getActiveBans();

      if (bans.length === 0) {
        await interaction.reply({
          content: '✅ Kaldırılacak aktif ban bulunmuyor.',
          ephemeral: true,
        });
        return;
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('banunban_select')
        .setPlaceholder('Unbanlayacak kullanıcıyı seçin...')
        .addOptions(
          bans.slice(0, 25).map((ban) => ({
            label: ban.username,
            description: ban.reason,
            value: ban.id.toString(),
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({
        content: 'Unbanlayacak kullanıcıyı seçin:',
        components: [row],
        ephemeral: true,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Banunban komutu hatası:', error);
      await interaction.reply({
        content: '❌ Bir hata oluştu.',
        ephemeral: true,
      });
    }
  },
};

export default command;
