import { EmbedBuilder } from 'discord.js';

export const turkishDate = (date: Date = new Date()): string => {
  return date.toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul' });
};

export const formatNumber = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

export const formatTimeout = (seconds: number): string => {
  if (seconds < 60) return `${seconds} saniye`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} dakika`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} saat`;
  return `${Math.floor(seconds / 86400)} gün`;
};

export const createErrorEmbed = (title: string, description: string): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('Red');
};

export const createSuccessEmbed = (title: string, description: string): EmbedBuilder => {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor('Green');
};
