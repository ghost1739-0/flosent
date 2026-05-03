import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
} from 'discord.js';
import type { BotCommand, BotClient } from '../types';
import { turkishDate } from '../utils/helpers';

const FARMEKLE_CHANNEL_ID = '1500135056440819840';
const AUTHORIZED_ROLE_ID = '1500135055148843142';

const command: BotCommand = {
  data: new SlashCommandBuilder()
    .setName('farmekle')
    .setDescription('Kullanıcıya farm (ot) ekler')
    .addUserOption((option) =>
      option
        .setName('kullanici')
        .setDescription('Farm eklenecek kullanıcı')
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName('ot')
        .setDescription('Eklenecek ot sayısı')
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      await interaction.deferReply({ ephemeral: true });
      const client = interaction.client as BotClient;
      const targetUser = interaction.options.getUser('kullanici', true);
      const amount = interaction.options.getInteger('ot', true);

      // Check for authorized role
      const member = interaction.member;
      const hasRole = member && 'roles' in member && (member.roles as any).cache.has(AUTHORIZED_ROLE_ID);

      if (!hasRole) {
        await interaction.editReply({
          content: '❌ Bu komutu kullanmak için gerekli yetkiye sahip değilsiniz.',
        });
        return;
      }

      // Check if command is used in correct channel
      if (interaction.channelId !== FARMEKLE_CHANNEL_ID) {
        await interaction.editReply({
          content: `❌ Bu komut sadece <#${FARMEKLE_CHANNEL_ID}> kanalında kullanılabilir.`,
        });
        return;
      }

      // Add farm log (using targetUser instead of interaction.user)
      client.db.addFarmLog(targetUser.id, targetUser.username, amount);
      client.db.addBotLog('farm_ekle', interaction.user.id, interaction.user.username, `Hedef: ${targetUser.username}, Ot: ${amount}`);

      const embed = new EmbedBuilder()
        .setTitle('🌿 Farm Eklendi')
        .setDescription(`<@${targetUser.id}> kullanıcısına **${amount}** ot eklendi.`)
        .addFields(
          { name: 'Ekleyen', value: `<@${interaction.user.id}>`, inline: true },
          { name: 'Miktar', value: `${amount} Ot`, inline: true },
          { name: 'Tarih', value: turkishDate(), inline: false }
        )
        .setColor('Green')
        .setTimestamp();

      await interaction.editReply({
        content: `✅ <@${targetUser.id}> için ${amount} ot başarıyla eklendi!`,
      });

      // Also send a public confirmation in the channel
      if (interaction.channel && 'send' in interaction.channel) {
        await (interaction.channel as any).send({ embeds: [embed] });
      }

    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Farmekle komutu hatası:', error);
      await interaction.editReply({
        content: '❌ Bir hata oluştu.',
      });
    }
  },
};

export default command;
