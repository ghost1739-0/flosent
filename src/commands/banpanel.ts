import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import type { BotCommand } from '../types';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('banpanel')
    .setDescription('Ban panelini gönderir')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const guild = interaction.guild;
      if (!guild) {
        await interaction.reply({ content: '❌ Bu komut sunucuda kullanılabilir.', ephemeral: true });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle('🛡️ Flosent | Yönetim & Bilgilendirme Sistemi')
        .setDescription(
          'Sunucu düzenini sağlamak ve ban süreçlerini takip etmek için aşağıdaki paneli kullanabilirsiniz.\n\n' +
          '**📌 Hızlı İşlemler:**\n' +
          '- **Ban Sebebi Bildir:** Uzaklaştırılma nedeninizi bildirin.\n' +
          '- **Banı Açılan:** Yetkililer için onaylı rol kaldırma menüsü.\n' +
          '- **Ban Listesi:** Herkesin görebileceği güncel özet ban listesi.'
        )
        .setColor(0x2f3136);

      if (guild.iconURL()) {
        embed.setThumbnail(guild.iconURL() as string);
      }

      if (interaction.client.user?.displayAvatarURL()) {
        embed.setFooter({
          text: 'Flosent Management • 2026',
          iconURL: interaction.client.user.displayAvatarURL(),
        });
      }

      const reportButton = new ButtonBuilder()
        .setCustomId('banpanel_report_open')
        .setLabel('Ban Sebebi Bildir')
        .setStyle(ButtonStyle.Danger);

      const openListButton = new ButtonBuilder()
        .setCustomId('banpanel_staff_open')
        .setLabel('Banı Açılan')
        .setStyle(ButtonStyle.Success);

      const listButton = new ButtonBuilder()
        .setCustomId('banpanel_list')
        .setLabel('Ban Listesi')
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(reportButton, openListButton, listButton);

      if (!interaction.channel || !('send' in interaction.channel)) {
        await interaction.reply({ content: '❌ Bu komut bir metin kanalında kullanılmalı.', ephemeral: true });
        return;
      }

      await interaction.channel.send({ embeds: [embed], components: [row] });
      await interaction.reply({ content: '✅ Ban paneli gönderildi.', ephemeral: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('banpanel komutu hatası:', error);
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp({ content: '❌ Bir hata oluştu.', ephemeral: true });
      } else {
        await interaction.reply({ content: '❌ Bir hata oluştu.', ephemeral: true });
      }
    }
  },
};

export default command;
