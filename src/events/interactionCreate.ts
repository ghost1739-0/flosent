import { Interaction, EmbedBuilder } from 'discord.js';
import type { BotEvent, BotClient } from '../types';

const AKTIFLIK_CHANNEL_ID = '1500135056637689938';
const FARMVER_CHANNEL_ID = '1500452813942030407';

const turkishDate = (date: Date = new Date()) => {
  return date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

export async function execute(interaction: Interaction): Promise<void> {
  const client = interaction.client as BotClient;

  try {
    // Handle slash commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);

      if (!command) {
        return;
      }

      try {
        await command.execute(interaction);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Komut hatası:', error);
        const errorEmbed = new EmbedBuilder()
          .setTitle('❌ Hata')
          .setDescription('Komut çalıştırılırken bir hata oluştu.')
          .setColor('Red');

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ embeds: [errorEmbed], ephemeral: true });
        } else {
          await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
        }
      }
      return;
    }

    // Handle button and select menu interactions
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Aktiflik onayla button
      if (customId.startsWith('aktiflik_onayla')) {
        try {
          const hasChecked = client.db.hasCheckedAktiflikToday(interaction.user.id);
          if (hasChecked) {
            await interaction.reply({
              content: '⚠️ Bugün zaten aktifliğini onayladın.',
              ephemeral: true,
            });
            return;
          }

          client.db.addAktiflikLog(interaction.user.id, interaction.user.username);
          client.db.addBotLog('aktiflik_kontrol', interaction.user.id, interaction.user.username);

          await interaction.reply({
            content: '✅ Aktifliğin onaylandı!',
            ephemeral: true,
          });

          // Update the embed to show new participant
          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const embed = EmbedBuilder.from(currentEmbed)
              .addFields({
                name: '👥 Katılımcılar',
                value: `${interaction.user.username} - ${turkishDate()}`,
                inline: false,
              });
            await message.edit({ embeds: [embed] });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Aktiflik button hatası:', error);
          await interaction.reply({
            content: '❌ Bir hata oluştu.',
            ephemeral: true,
          });
        }
        return;
      }

      // In-game session buttons
      if (customId.startsWith('ingame_katil_')) {
        try {
          const sessionId = parseInt(customId.replace('ingame_katil_', ''), 10);
          const session = client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.reply({
              content: '❌ Bu oturum artık aktif değil.',
              ephemeral: true,
            });
            return;
          }

          const participants = client.db.getIngameSessionParticipants(sessionId);

          if (participants.some((p) => p.id === interaction.user.id)) {
            await interaction.reply({
              content: '⚠️ Zaten katıldınız.',
              ephemeral: true,
            });
            return;
          }

          if (participants.length >= 20) {
            await interaction.reply({
              content: '⚠️ Oturum dolu! (20/20)',
              ephemeral: true,
            });
            return;
          }

          client.db.addIngameSessionParticipant(sessionId, interaction.user.id, interaction.user.username);
          const updatedParticipants = client.db.getIngameSessionParticipants(sessionId);

          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const participantList = updatedParticipants
              .map((p, i) => `${i + 1}. ${p.username}`)
              .join('\n') || 'Katılımcı yok';

            const embed = EmbedBuilder.from(currentEmbed)
              .setFields(
                {
                  name: '👥 Katılımcılar',
                  value: participantList,
                  inline: false,
                },
                {
                  name: '📊 Toplam',
                  value: `Katılımcı Sayısı: ${updatedParticipants.length}/20`,
                  inline: false,
                }
              );
            await message.edit({ embeds: [embed] });
          }

          await interaction.reply({
            content: '✅ Oturuma katıldın!',
            ephemeral: true,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('In-game katıl button hatası:', error);
          await interaction.reply({
            content: '❌ Bir hata oluştu.',
            ephemeral: true,
          });
        }
        return;
      }

      if (customId.startsWith('ingame_ayril_')) {
        try {
          const sessionId = parseInt(customId.replace('ingame_ayril_', ''), 10);
          const session = client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.reply({
              content: '❌ Bu oturum artık aktif değil.',
              ephemeral: true,
            });
            return;
          }

          client.db.removeIngameSessionParticipant(sessionId, interaction.user.id);
          const updatedParticipants = client.db.getIngameSessionParticipants(sessionId);

          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const participantList = updatedParticipants
              .map((p, i) => `${i + 1}. ${p.username}`)
              .join('\n') || 'Katılımcı yok';

            const embed = EmbedBuilder.from(currentEmbed)
              .setFields(
                {
                  name: '👥 Katılımcılar',
                  value: participantList,
                  inline: false,
                },
                {
                  name: '📊 Toplam',
                  value: `Katılımcı Sayısı: ${updatedParticipants.length}/20`,
                  inline: false,
                }
              );
            await message.edit({ embeds: [embed] });
          }

          await interaction.reply({
            content: '✅ Oturumdan ayrıldın!',
            ephemeral: true,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('In-game ayrıl button hatası:', error);
          await interaction.reply({
            content: '❌ Bir hata oluştu.',
            ephemeral: true,
          });
        }
        return;
      }

      // Pagination buttons for ban list
      if (customId.startsWith('ban_page_')) {
        try {
          const parts = customId.split('_');
          const direction = parts[2];
          const userId = parts[3];

          if (interaction.user.id !== userId) {
            await interaction.reply({
              content: '❌ Bu buton sana ait değil.',
              ephemeral: true,
            });
            return;
          }

          const bans = client.db.getActiveBans();
          const itemsPerPage = 5;
          const totalPages = Math.ceil(bans.length / itemsPerPage);
          const currentPage = parseInt(parts[4] ?? '1', 10);
          let newPage = currentPage;

          if (direction === 'next' && currentPage < totalPages) {
            newPage = currentPage + 1;
          } else if (direction === 'prev' && currentPage > 1) {
            newPage = currentPage - 1;
          }

          const startIdx = (newPage - 1) * itemsPerPage;
          const endIdx = startIdx + itemsPerPage;
          const pageBans = bans.slice(startIdx, endIdx);

          let description = pageBans
            .map((ban) => `**${ban.username}** - *${ban.reason}*\n└─ Banlayan: ${ban.banned_by} | ${new Date(ban.banned_at).toLocaleString('tr-TR')}`)
            .join('\n\n');

          if (!description) {
            description = 'Bu sayfada ban yok.';
          }

          const embed = new EmbedBuilder()
            .setTitle('🔨 Ban Listesi')
            .setDescription(description)
            .setFooter({ text: `Sayfa ${newPage}/${totalPages}` })
            .setColor('Red');

          await interaction.update({ embeds: [embed] });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban pagination button hatası:', error);
          await interaction.deferUpdate();
        }
        return;
      }
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      if (customId === 'banunban_select') {
        try {
          const banId = parseInt(interaction.values[0], 10);
          const ban = client.db.getBanById(banId);

          if (!ban) {
            await interaction.reply({
              content: '❌ Ban bulunamadı.',
              ephemeral: true,
            });
            return;
          }

          client.db.unbanUser(banId);
          client.db.addBotLog('unban', ban.discord_id, ban.username, `Ban kaldırıldı: ${ban.reason}`);

          const guild = interaction.guild;
          if (guild) {
            try {
              await guild.members.unban(ban.discord_id);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Discord unban hatası:', error);
            }
          }

          // Try to DM the user
          try {
            const user = await interaction.client.users.fetch(ban.discord_id);
            await user.send(`✅ ${guild?.name || 'Sunucu'}daki banınız kaldırıldı. Tekrar katılabilirsiniz.`);
          } catch {
            // Silently fail if user has DMs closed
          }

          const embed = new EmbedBuilder()
            .setTitle('✅ Ban Kaldırıldı')
            .addFields(
              { name: 'Kullanıcı', value: ban.username, inline: true },
              {
                name: 'Tarih',
                value: new Date(ban.banned_at).toLocaleString('tr-TR'),
                inline: true
              }
            )
            .setColor('Green');

          const channel = interaction.channel;
          if (channel && 'send' in channel) {
            await channel.send({ embeds: [embed] });
          }

          await interaction.reply({
            content: '✅ Kullanıcının banı kaldırıldı!',
            ephemeral: true,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Banunban select hatası:', error);
          await interaction.reply({
            content: '❌ Bir hata oluştu.',
            ephemeral: true,
          });
        }
        return;
      }
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Interaction handler error:', error);
  }
}

export default { name: 'interactionCreate', execute } satisfies BotEvent;
