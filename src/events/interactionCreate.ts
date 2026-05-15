import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Interaction,
  ModalBuilder,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import type { BotEvent, BotClient } from '../types';
import { finalizeAktiflikSession } from '../commands/aktiflik';
import { buildUpdatedIngameEmbed, syncIngameAnnouncement, getIngameTotalCapacity } from '../utils/ingameAnnouncement';

const AKTIFLIK_CHANNEL_ID = '1500135056637689938';
const AKTIFLIK_ROLE_ID = '1504751366826885230';
const FARMVER_CHANNEL_ID = '1500452813942030407';
const AKTIFLIK_PANEL_PERM_ROLE_ID = '1500135055148843147';
const AKTIFLIK_PERM_CONFIRM_PREFIX = 'aktiflik_permcek_confirm_';
const AKTIFLIK_PERM_CANCEL_PREFIX = 'aktiflik_permcek_cancel_';
const BAN_PANEL_LOG_CHANNEL_ID = '1504489762281619666';
const BAN_PANEL_OG_ROL_ID = '1500135055207567599';
const BAN_PANEL_SECOND_OG_ROL_ID = '1500135149403246644';
const BAN_PANEL_BOSS_ROL_ID = '1500135055224340565';
const BAN_PANEL_BANLI_ROL_ID = '1500909878213087374';
const BAN_PANEL_REPORT_MODAL_ID = 'banpanel_report_modal';
const BAN_PANEL_STAFF_OPEN_ID = 'banpanel_staff_open';
const BAN_PANEL_LIST_ID = 'banpanel_list';
const BAN_PANEL_SELECT_ID = 'banpanel_select_ban';
const BAN_PANEL_UNBAN_CONFIRM_PREFIX = 'banpanel_unban_confirm_';
const BAN_PANEL_UNBAN_CANCEL_PREFIX = 'banpanel_unban_cancel_';

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

function buildAktiflikPermConfirmCustomId(sessionId: number, channelId: string, messageId: string): string {
  return `aktiflik_permcek_confirm_${sessionId}_${channelId}_${messageId}`;
}

function parseAktiflikPermConfirmCustomId(customId: string): { sessionId: number; channelId: string; messageId: string } | null {
  const match = customId.match(/^aktiflik_permcek_confirm_(\d+)_([0-9]+)_([0-9]+)$/);
  if (!match) {
    return null;
  }

  return {
    sessionId: Number(match[1]),
    channelId: match[2],
    messageId: match[3],
  };
}

function hasBanStaffAccess(member: unknown): boolean {
  if (!member || typeof member !== 'object' || !('roles' in member)) {
    return false;
  }

  const roles = (member as { roles?: { cache?: { has: (roleId: string) => boolean } } | string[] }).roles;
  if (!roles) {
    return false;
  }

  const roleIds = [BAN_PANEL_OG_ROL_ID, BAN_PANEL_SECOND_OG_ROL_ID, BAN_PANEL_BOSS_ROL_ID];

  if (Array.isArray(roles)) {
    return roleIds.some((roleId) => roles.includes(roleId));
  }

  if ('cache' in roles && roles.cache) {
    return roleIds.some((roleId) => roles.cache?.has(roleId) ?? false);
  }

  return false;
}

function formatBanListMessage(bans: Array<{ id: number; discord_id: string; username: string; reason: string; ban_code: string }>): string {
  if (!bans.length) {
    return 'ℹ️ Şu anda aktif banlı kullanıcı kaydı bulunmuyor.';
  }

  const lines: string[] = ['**📋 Güncel Ban Listesi**', ''];
  for (const ban of bans) {
    const line = `• kişi <@${ban.discord_id}> sebep ${ban.reason} ban id ${ban.ban_code}`;
    const candidate = [...lines, line].join('\n');
    if (candidate.length > 1900) {
      lines.push(`... ve ${bans.length - lines.length + 2} kişi daha`);
      break;
    }
    lines.push(line);
  }

  return lines.join('\n');
}

function buildBanPanelModal(): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(BAN_PANEL_REPORT_MODAL_ID)
    .setTitle('Flosent | Ban Sebebi Bildirimi');

  const reasonInput = new TextInputBuilder()
    .setCustomId('banpanel_reason')
    .setLabel('Neden Ban Yediniz?')
    .setPlaceholder('Sebep...')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const banCodeInput = new TextInputBuilder()
    .setCustomId('banpanel_ban_code')
    .setLabel('Ban ID Numaranız')
    .setPlaceholder('Örn: XKPWÖ')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(banCodeInput)
  );

  return modal;
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

      if (customId === 'banpanel_report_open') {
        await interaction.showModal(buildBanPanelModal());
        return;
      }

      if (customId === BAN_PANEL_LIST_ID) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const bans = await client.db.getActiveBans();
          await interaction.editReply({ content: formatBanListMessage(bans) });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban listesi button hatası:', error);
          await interaction.editReply({ content: '❌ Bir hata oluştu.' });
        }
        return;
      }

      if (customId === BAN_PANEL_STAFF_OPEN_ID) {
        try {
          await interaction.deferReply({ ephemeral: true });
          if (!hasBanStaffAccess(interaction.member)) {
            await interaction.editReply({ content: '❌ Bu işlemi sadece yetkili personeller gerçekleştirebilir.' });
            return;
          }

          const bans = await client.db.getActiveBans();
          if (!bans.length) {
            await interaction.editReply({ content: 'ℹ️ Şu anda sistemde kayıtlı ban bildirimi bulunmuyor.' });
            return;
          }

          const options = bans.slice(0, 25).map((ban) => ({
            label: ban.username.slice(0, 100),
            value: String(ban.id),
            description: `ID: ${ban.ban_code} | Sebep: ${ban.reason.slice(0, 50)}`.slice(0, 100),
          }));

          const select = new StringSelectMenuBuilder()
            .setCustomId(BAN_PANEL_SELECT_ID)
            .setPlaceholder('Banı açılacak kullanıcıyı seçin...')
            .addOptions(options);

          const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select);
          const extraNote = bans.length > 25 ? `\n\n⚠️ İlk 25 kayıt listeleniyor, toplam: ${bans.length}` : '';

          await interaction.editReply({
            content: `Lütfen işlem yapmak istediğiniz kullanıcıyı listeden seçin:${extraNote}`,
            components: [row],
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban açılan button hatası:', error);
          await interaction.editReply({ content: '❌ Bir hata oluştu.' });
        }
        return;
      }

      if (customId.startsWith(BAN_PANEL_UNBAN_CANCEL_PREFIX)) {
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: 'İşlem iptal edildi.' });
        return;
      }

      if (customId.startsWith(BAN_PANEL_UNBAN_CONFIRM_PREFIX)) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const banId = Number(customId.replace(BAN_PANEL_UNBAN_CONFIRM_PREFIX, ''));
          const ban = await client.db.getBanById(banId);

          if (!ban) {
            await interaction.editReply({ content: '❌ Kayıt bulunamadı.' });
            return;
          }

          const guild = interaction.guild;
          if (!guild) {
            await interaction.editReply({ content: '❌ Bu işlem sadece sunucuda yapılabilir.' });
            return;
          }

          const member = await guild.members.fetch(ban.discord_id).catch(() => null);
          const banliRole = guild.roles.cache.get(BAN_PANEL_BANLI_ROL_ID);

          if (member && banliRole && member.roles.cache.has(banliRole.id)) {
            await member.roles.remove(banliRole).catch(() => null);
          }

          if (member) {
            await member.send('Banın açıldı gir Wl al').catch(() => null);
          }

          await client.db.unbanUser(banId);

          const logChannel = guild.channels.cache.get(BAN_PANEL_LOG_CHANNEL_ID)
            ?? await guild.channels.fetch(BAN_PANEL_LOG_CHANNEL_ID).catch(() => null);
          if (logChannel && 'send' in logChannel) {
            const logEmbed = new EmbedBuilder()
              .setTitle('🔓 Ceza Onayla Kaldırıldı')
              .setColor('Green')
              .setTimestamp(new Date())
              .addFields(
                { name: '🎯 İşlem Yapılan', value: `<@${ban.discord_id}>`, inline: true },
                { name: '👮 Onaylayan Yetkili', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📝 Eski Sebep', value: ban.reason, inline: false },
                { name: '🆔 Ban ID', value: ban.ban_code, inline: true }
              );

            await logChannel.send({ embeds: [logEmbed] });
          }

          await interaction.editReply({ content: '✅ Onaylandı.' });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban kaldırma onay button hatası:', error);
          await interaction.editReply({ content: '❌ Hata onaylanamadı.' });
        }
        return;
      }

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
            const role = interaction.guild?.roles.cache.get(AKTIFLIK_ROLE_ID);
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

      if (customId.startsWith(AKTIFLIK_PERM_CANCEL_PREFIX)) {
        await interaction.deferReply({ ephemeral: true });
        await interaction.editReply({ content: 'İşlem iptal edildi.' });
        return;
      }

      if (customId.startsWith(AKTIFLIK_PERM_CONFIRM_PREFIX)) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const parsed = parseAktiflikPermConfirmCustomId(customId);
          if (!parsed) {
            await interaction.editReply({ content: '❌ Geçersiz onay butonu.' });
            return;
          }

          const { sessionId, channelId, messageId } = parsed;
          const session = await client.db.getAktiflikSessionById(sessionId);

          if (!session) {
            await interaction.editReply({ content: '❌ Oturum bulunamadı.' });
            return;
          }

          const guild = interaction.guild;
          if (!guild) {
            await interaction.editReply({ content: '❌ Bu işlem sadece sunucuda yapılabilir.' });
            return;
          }

          // Fetch members and get the target role
          await guild.members.fetch().catch(() => null);
          const role = guild.roles.cache.get(AKTIFLIK_ROLE_ID);
          if (!role) {
            await interaction.editReply({ content: '❌ Rol bulunamadı.' });
            return;
          }

          const roleMembers = Array.from(role.members.values());
          
          // Get panel message and channel
          const panelChannel = guild.channels.cache.get(channelId)
            ?? await guild.channels.fetch(channelId).catch(() => null);
          if (!panelChannel || !('messages' in panelChannel)) {
            await interaction.editReply({ content: '❌ Panel kanalı bulunamadı.' });
            return;
          }

          const panelMessage = await panelChannel.messages.fetch(messageId).catch(() => null);

          // Query participants from database - most reliable method
          const participants = await client.db.getAktiflikSessionParticipants(sessionId);
          const joinedIds = new Set(participants.map((participant) => participant.id));

          // Calculate missed members (those with role but didn't participate)
          const missedMembers = roleMembers.filter((member) => {
            if (member.user.bot) {
              return false;
            }
            return !joinedIds.has(member.id);
          });

          if (!missedMembers.length) {
            await interaction.editReply({ content: '❌ Oturum bulunamadı veya perm çekilecek kişi kalmadı.' });
            return;
          }

          // Remove all roles and set only the panel permission role
          let successCount = 0;
          for (const member of missedMembers) {
            try {
              await member.roles.set([AKTIFLIK_PANEL_PERM_ROLE_ID]);
              successCount++;
            } catch (error) {
              // eslint-disable-next-line no-console
              console.error(`[Aktiflik Perm] Hata ${member.user.username}(${member.id}):`, error);
            }
          }

          // Update panel message
          if (panelMessage?.embeds[0]) {
            const updatedEmbed = EmbedBuilder.from(panelMessage.embeds[0]).addFields({
              name: '✅ Perm Durumu',
              value: `Perm çekilen kişi sayısı: **${successCount}**`,
              inline: false,
            });

            const disabledButton = new ButtonBuilder()
              .setCustomId(`aktiflik_permcek_${sessionId}`)
              .setLabel('🎭 Permleri Çekildi')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true);

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(disabledButton);
            await panelMessage.edit({ embeds: [updatedEmbed], components: [row] }).catch(() => null);
          }

          await interaction.editReply({
            content: `✅ ${successCount}/${missedMembers.length} katılmayan üyenin permleri güncellendi.`,
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

      if (customId.startsWith('aktiflik_permcek_')) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const sessionId = parseInt(customId.replace('aktiflik_permcek_', ''), 10);
          const session = await client.db.getAktiflikSessionById(sessionId);

          if (!session) {
            await interaction.editReply({ content: '❌ Oturum bulunamadı.' });
            return;
          }

          const confirmCustomId = buildAktiflikPermConfirmCustomId(sessionId, interaction.message.channelId, interaction.message.id);
          const cancelCustomId = `aktiflik_permcek_cancel_${sessionId}`;

          const yesButton = new ButtonBuilder()
            .setCustomId(confirmCustomId)
            .setLabel('Evet')
            .setStyle(ButtonStyle.Danger);

          const noButton = new ButtonBuilder()
            .setCustomId(cancelCustomId)
            .setLabel('Hayır')
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesButton, noButton);

          await interaction.editReply({
            content: 'Emin misin? Bu işlem katılmayan üyelerin rollerini değiştirecek.',
            components: [row],
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Aktiflik perm onay button hatası:', error);
          await interaction.editReply({
            content: '❌ Bir hata oluştu.',
          });
        }
        return;
      }

    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === BAN_PANEL_REPORT_MODAL_ID) {
        try {
          await interaction.deferReply({ ephemeral: true });

          const reason = interaction.fields.getTextInputValue('banpanel_reason').trim();
          const banCode = interaction.fields.getTextInputValue('banpanel_ban_code').trim();

          await client.db.addBan(interaction.user.id, interaction.user.username, reason, banCode, interaction.user.id);

          const guild = interaction.guild;
          const logChannel = guild
            ? guild.channels.cache.get(BAN_PANEL_LOG_CHANNEL_ID) ?? await guild.channels.fetch(BAN_PANEL_LOG_CHANNEL_ID).catch(() => null)
            : null;

          if (guild && logChannel && 'send' in logChannel) {
            const banliRole = guild.roles.cache.get(BAN_PANEL_BANLI_ROL_ID);
            const reportEmbed = new EmbedBuilder()
              .setTitle('🚫 Yeni Ban Sebebi Bildirimi')
              .setColor('Red')
              .setTimestamp(interaction.createdAt)
              .addFields(
                { name: '👤 Kullanıcı', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: false },
                { name: '📝 Belirtilen Sebep', value: reason, inline: false },
                { name: '🆔 Ban ID', value: banCode, inline: true }
              )
              .setThumbnail(interaction.user.displayAvatarURL());

            await logChannel.send({
              content: banliRole ? `<@&${banliRole.id}> Yeni bir ban bildirimi geldi!` : 'Yeni bir ban bildirimi geldi!',
              embeds: [reportEmbed],
              allowedMentions: { roles: banliRole ? [banliRole.id] : [] },
            });
          }

          await interaction.editReply({ content: '✅ Bilgileriniz başarıyla yetkililere iletildi.' });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban sebebi modal hatası:', error);
          await interaction.editReply({ content: '❌ Bir hata oluştu.' });
        }
        return;
      }
    }

    // Handle select menus
    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === BAN_PANEL_SELECT_ID) {
        try {
          await interaction.deferReply({ ephemeral: true });
          const banId = Number(interaction.values[0]);
          const ban = await client.db.getBanById(banId);

          if (!ban) {
            await interaction.editReply({ content: '❌ Bu kullanıcı artık listede bulunmuyor.' });
            return;
          }

          const embed = new EmbedBuilder()
            .setTitle('🔎 Kullanıcı Ban Detayı')
            .setColor('Blue')
            .addFields(
              { name: 'Kişi', value: `<@${ban.discord_id}>`, inline: true },
              { name: 'Ban ID', value: ban.ban_code, inline: true },
              { name: 'Sebep', value: ban.reason, inline: false }
            );

          const yesButton = new ButtonBuilder()
            .setCustomId(`banpanel_unban_confirm_${ban.id}`)
            .setLabel('Banı Aç')
            .setStyle(ButtonStyle.Success);

          const noButton = new ButtonBuilder()
            .setCustomId(`banpanel_unban_cancel_${ban.id}`)
            .setLabel('İptal')
            .setStyle(ButtonStyle.Secondary);

          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(yesButton, noButton);

          await interaction.editReply({
            content: 'Seçtiğiniz kullanıcının bilgileri aşağıdadır:',
            embeds: [embed],
            components: [row],
          });
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('Ban select menü hatası:', error);
          await interaction.editReply({ content: '❌ Bir hata oluştu.' });
        }
        return;
      }

      return;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Interaction handler error:', error);
  }
}

export default { name: 'interactionCreate', execute } satisfies BotEvent;
