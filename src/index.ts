import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { loadEvents } from './handlers/eventHandler';
import { loadCommands } from './handlers/commandHandler';
import { db } from './database/db';
import type { BotClient, BotCommand } from './types';
import express from 'express';

loadEnv();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel, Partials.GuildMember, Partials.User, Partials.Message],
}) as BotClient;

client.commands = new Collection<string, BotCommand>();
client.cooldowns = new Map<string, number>();
client.db = db;

loadEvents(client);
loadCommands(client);

// Render için HTTP server
const app = express();
app.get('/', (_req, res) => res.send('Bot çalışıyor!'));
app.listen(process.env.PORT || 3000, () => {
  console.log(`HTTP server ayakta: ${process.env.PORT || 3000}`);
});

async function start(): Promise<void> {
  if (!process.env.TOKEN) {
    throw new Error('TOKEN ortam değişkeni eksik.');
  }
  await client.login(process.env.TOKEN);
}

void start().catch((error: unknown) => {
  console.error('Bot başlatılamadı:', error);
  process.exitCode = 1;
});