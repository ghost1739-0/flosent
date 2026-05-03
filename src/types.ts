import type {
  Client,
  SlashCommandBuilder,
} from 'discord.js';
import type { DatabaseManager } from './database/db';

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}

export interface BotCommand {
  data: SlashCommandBuilder | any; // Allow builder return type
  execute: (interaction: any) => Promise<void>;
}

export interface BotClient extends Client {
  commands: Map<string, BotCommand>;
  cooldowns: Map<string, number>;
  db: DatabaseManager;
}
