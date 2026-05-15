import { Interaction, EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotEvent, BotClient } from '../types';
import { finalizeAktiflikSession } from '../commands/aktiflik';
import { buildUpdatedIngameEmbed, syncIngameAnnouncement, getIngameTotalCapacity } from '../utils/ingameAnnouncement';

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
          await interaction.deferUpdate();

          const displayName = interaction.member && 'displayName' in interaction.member ? (interaction.member as any).displayName : interaction.user.username;
          const parts = customId.split('_');
          const sessionId = Number(parts[2]);
          const session = await client.db.getAktiflikSessionByMessageId(interaction.message.id);

          if (!session || session.id !== sessionId) {
            await interaction.followUp({ content: '⚠️ Bu aktiflik oturumu kapandi.', ephemeral: true });
            return;
          }

          if (new Date(session.ends_at).getTime() <= Date.now()) {
            await interaction.followUp({ content: '⚠️ Bu aktiflik oturumu suresi doldu.', ephemeral: true });
            return;
          }

          if (session.active !== 1) {
            await interaction.followUp({ content: '⚠️ Bu aktiflik oturumu kapandi.', ephemeral: true });
            return;
          }

          const alreadyInSession = await client.db.hasJoinedAktiflikSession(sessionId, interaction.user.id);
          if (alreadyInSession) {
            await interaction.followUp({ content: '⚠️ Zaten katıldın.', ephemeral: true });
            return;
          }

          const inserted = await client.db.addAktiflikSessionParticipant(sessionId, interaction.user.id, displayName);
          if (!inserted) {
            await interaction.followUp({ content: '⚠️ Zaten katıldın.', ephemeral: true });
            return;
          }

          // Record click in daily log for audit
          await client.db.addAktiflikLog(interaction.user.id, displayName);
          await client.db.addBotLog('aktiflik_kontrol', interaction.user.id, displayName);

          await interaction.followUp({
            content: '✅ Aktifliğin onaylandı!',
            ephemeral: true
          });

          // Update the embed to show new participant
          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const participants = await client.db.getAktiflikSessionParticipants(sessionId);
            const role = interaction.guild?.roles.cache.get('1500135055207567590');
            const total = role?.members.size ?? 0;
            const names = participants
              .map((p) => '✅ ' + (p.id ? `<@${p.id}>` : p.username))
              .join('\n');
            const participantValue = names.length > 1000 ? `${names.slice(0, 980)}\n...` : (names || 'Yok');

            const newEmbed = EmbedBuilder.from(currentEmbed).setFields(
              {
                name: '📊 Katilim',
                value: `${participants.length}/${total}`,
                inline: false,
              },
              {
                name: `✅ Katilanlar (${participants.length})`,
                value: participantValue,
                inline: false,
              }
            );
            await message.edit({ embeds: [newEmbed] });
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Aktiflik button hatası:', error);
          if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
              content: '❌ Bir hata oluştu.',
            });
          }
        }
        return;
      }

      // In-game session buttons
      if (customId.startsWith('ingame_katil_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const sessionId = parseInt(customId.replace('ingame_katil_', ''), 10);
          const session = await client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.editReply({
              content: '❌ Bu oturum artık aktif değil.',
            });
            return;
          }

          const participants = await client.db.getIngameSessionParticipants(sessionId);

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
          await client.db.addIngameSessionParticipant(sessionId, interaction.user.id, displayName);
          await client.db.removeIngameSessionQParticipant(sessionId, interaction.user.id);
          await client.db.resetIngameQMiss(interaction.user.id);
          const updatedParticipants = await client.db.getIngameSessionParticipants(sessionId);
          const qParticipants = await client.db.getIngameSessionQParticipants(sessionId);

          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const totalCapacity = getIngameTotalCapacity(currentEmbed);
            const embed = buildUpdatedIngameEmbed(currentEmbed, updatedParticipants, qParticipants, totalCapacity);
            await message.edit({ embeds: [embed] });
            await syncIngameAnnouncement(interaction.message.channel, {
              id: sessionId,
              message_id: session.message_id,
              channel_id: session.channel_id,
              last_q_announcement_message_id: session.last_q_announcement_message_id,
            }, embed.toJSON());
          }

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
          const session = await client.db.getActiveIngameSession();

          if (!session || session.id !== sessionId) {
            await interaction.editReply({
              content: '❌ Bu oturum artık aktif değil.',
            });
            return;
          }

          await client.db.removeIngameSessionParticipant(sessionId, interaction.user.id);
          const updatedParticipants = await client.db.getIngameSessionParticipants(sessionId);
          const qParticipants = await client.db.getIngameSessionQParticipants(sessionId);

          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const totalCapacity = getIngameTotalCapacity(currentEmbed);
            const embed = buildUpdatedIngameEmbed(currentEmbed, updatedParticipants, qParticipants, totalCapacity);
            await message.edit({ embeds: [embed] });
            await syncIngameAnnouncement(interaction.message.channel, {
              id: sessionId,
              message_id: session.message_id,
              channel_id: session.channel_id,
              last_q_announcement_message_id: session.last_q_announcement_message_id,
            }, embed.toJSON());
          }

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

    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      return;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Interaction handler error:', error);
  }
}

export default { name: 'interactionCreate', execute } satisfies BotEvent;
