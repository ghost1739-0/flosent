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
          await interaction.deferReply({ ephemeral: true });

          const displayName = interaction.member && 'displayName' in interaction.member ? (interaction.member as any).displayName : interaction.user.username;

          // Record click (no per-user limit)
          client.db.addAktiflikLog(interaction.user.id, displayName);
          client.db.addBotLog('aktiflik_kontrol', interaction.user.id, displayName);

          // Public notification with @everyone
          // const messageChannel = interaction.message.channel;
          // if (messageChannel && 'send' in messageChannel) {
          //   await messageChannel.send({
          //     content: `@everyone ${displayName} aktifliğini onayladı.`,
          //     allowedMentions: { parse: ['everyone'] },
          //   });
          // } // TODO: Re-enable @everyone notification later

          await interaction.editReply({
            content: '✅ Aktifliğin onaylandı!',
          });

          // Update the embed to show new participant
          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const embed = EmbedBuilder.from(currentEmbed);
            const fields = embed.data.fields ?? [];
            const participantFieldIdx = fields.findIndex(f => f.name === '👥 Katılımcılar');
            let participantValue = 'Katılımcı yok';
            if (participantFieldIdx !== -1) {
              participantValue = fields[participantFieldIdx].value || 'Katılımcı yok';
            }
            const newValue = participantValue === 'Katılımcı yok' ? `${displayName} - ${turkishDate()}` : `${participantValue}\n${displayName} - ${turkishDate()}`;

            if (participantFieldIdx !== -1) {
              fields[participantFieldIdx].value = newValue;
            } else {
              fields.push({ name: '👥 Katılımcılar', value: newValue, inline: false });
            }

            const newEmbed = EmbedBuilder.from(currentEmbed).setFields(...fields);
            await message.edit({ embeds: [newEmbed] });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Aktiflik button hatası:', error);
          await interaction.editReply({
            content: '❌ Bir hata oluştu.',
          });
        }
        return;
      }

      // In-game session buttons
      if (customId.startsWith('ingame_katil_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const sessionId = parseInt(customId.replace('ingame_katil_', ''), 10);
          const session = client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.editReply({
              content: '❌ Bu oturum artık aktif değil.',
            });
            return;
          }

          const participants = client.db.getIngameSessionParticipants(sessionId);

          if (participants.some((p) => p.id === interaction.user.id)) {
            await interaction.editReply({
              content: '⚠️ Zaten katıldınız.',
            });
            return;
          }

          if (participants.length >= 20) {
            await interaction.editReply({
              content: '⚠️ Oturum dolu! (20/20)',
            });
            return;
          }

          const displayName = interaction.member && 'displayName' in interaction.member ? (interaction.member as any).displayName : interaction.user.username;
          client.db.addIngameSessionParticipant(sessionId, interaction.user.id, displayName);
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

          // Public @everyone notice
          // const channel = message.channel;
          // if (channel && 'send' in channel) {
          //   await channel.send({ content: `@everyone ${displayName} oturuma katıldı.`, allowedMentions: { parse: ['everyone'] } });
          // } // TODO: Re-enable @everyone notification later

          await interaction.editReply({
            content: '✅ Oturuma katıldın!',
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('In-game katıl button hatası:', error);
          await interaction.editReply({
            content: '❌ Bir hata oluştu.',
          });
        }
        return;
      }

      if (customId.startsWith('ingame_ayril_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const sessionId = parseInt(customId.replace('ingame_ayril_', ''), 10);
          const session = client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.editReply({
              content: '❌ Bu oturum artık aktif değil.',
            });
            return;
          }

          const displayName = interaction.member && 'displayName' in interaction.member ? (interaction.member as any).displayName : interaction.user.username;
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

          // Public @everyone notice
          // const channel = message.channel;
          // if (channel && 'send' in channel) {
          //   await channel.send({ content: `@everyone ${displayName} oturumdan ayrıldı.`, allowedMentions: { parse: ['everyone'] } });
          // } // TODO: Re-enable @everyone notification later

          await interaction.editReply({
            content: '✅ Oturumdan ayrıldın!',
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('In-game ayrıl button hatası:', error);
          await interaction.editReply({
            content: '❌ Bir hata oluştu.',
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
            await interaction.deferReply({ ephemeral: true });
            await interaction.editReply({
              content: '❌ Bu buton sana ait değil.',
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
          await interaction.deferReply({ ephemeral: true });
          const banId = parseInt(interaction.values[0], 10);
          const ban = client.db.getBanById(banId);

          if (!ban) {
            await interaction.editReply({
              content: '❌ Ban bulunamadı.',
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

          await interaction.editReply({
            content: '✅ Kullanıcının banı kaldırıldı!',
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Banunban select hatası:', error);
          await interaction.editReply({
            content: '❌ Bir hata oluştu.',
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
