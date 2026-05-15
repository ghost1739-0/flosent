import { Interaction, EmbedBuilder, Guild, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { BotEvent, BotClient } from '../types';
import { finalizeAktiflikSession } from '../commands/aktiflik';
import { buildUpdatedIngameEmbed, syncIngameAnnouncement, getIngameTotalCapacity } from '../utils/ingameAnnouncement';

const AKTIFLIK_CHANNEL_ID = '1500135056637689938';
const AKTIFLIK_ROLE_ID = '1504751366826885230';
const FARMVER_CHANNEL_ID = '1500452813942030407';
const AKTIFLIK_PANEL_PERM_ROLE_ID = '1500135055148843147';

const turkishDate = (date: Date = new Date()) => {
  return date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

function extractMentionedUserIds(text: string): Set<string> {
  const ids = new Set<string>();
  for (const match of text.matchAll(/<@!?(\d+)>/g)) {
    ids.add(match[1]);
  }
  return ids;
}

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
            const role = interaction.guild?.roles.cache.get('1504751366826885230');
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

      if (customId.startsWith('aktiflik_permcek_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const sessionId = parseInt(customId.replace('aktiflik_permcek_', ''), 10);
          const session = await client.db.getAktiflikSessionById(sessionId);

          const guild = interaction.guild;
          if (!guild) {
            await interaction.editReply({ content: '❌ Bu işlem sadece sunucuda yapılabilir.' });
            return;
          }

          await guild.members.fetch().catch(() => null);
          const roleId = session?.target_role_id ?? AKTIFLIK_ROLE_ID;
          const role = guild.roles.cache.get(roleId);
          const roleMembers = role ? Array.from(role.members.values()) : [];
          const panelMentionIds = extractMentionedUserIds(interaction.message.content);
          const participants = session ? await client.db.getAktiflikSessionParticipants(sessionId) : [];
          const joinedIds = new Set(participants.map((participant) => participant.id));
          const missedMembers = roleMembers.filter((member) => {
            if (member.user.bot) {
              return false;
            }

            if (session) {
              return !joinedIds.has(member.id);
            }

            return panelMentionIds.has(member.id);
          });

          if (!missedMembers.length) {
            await interaction.editReply({ content: '❌ Oturum bulunamadı veya perm çekilecek kişi kalmadı.' });
            return;
          }

          for (const member of missedMembers) {
            try {
              await member.roles.set([AKTIFLIK_PANEL_PERM_ROLE_ID]);
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error('Aktiflik perm çekme hatası:', error);
            }
          }

          const message = interaction.message;
          const currentEmbed = message.embeds[0];
          if (currentEmbed) {
            const updatedEmbed = EmbedBuilder.from(currentEmbed).addFields({
              name: '✅ Perm Durumu',
              value: `Perm çekilen kişi sayısı: **${missedMembers.length}**`,
              inline: false,
            });

            const disabledButton = new ButtonBuilder()
              .setCustomId(`aktiflik_permcek_${sessionId}`)
              .setLabel('🎭 Permleri Çekildi')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);
            await message.edit({ embeds: [updatedEmbed], components: [row] });
          }

          await interaction.editReply({
            content: `✅ ${missedMembers.length} katılmayan üyenin perm düzeni güncellendi.`,
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Aktiflik perm çekme button hatası:', error);
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
