import { Client, GatewayIntentBits, Partials, Collection } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { loadEvents } from './handlers/eventHandler';
import { loadCommands } from './handlers/commandHandler';
import { db } from './database/db';
import type { BotClient, BotCommand } from './types';

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

async function start(): Promise<void> {
  if (!process.env.TOKEN) {
    throw new Error('TOKEN ortam değişkeni eksik.');
  }

  await client.login(process.env.TOKEN);
}

void start().catch((error: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Bot başlatılamadı:', error);
  process.exitCode = 1;
});