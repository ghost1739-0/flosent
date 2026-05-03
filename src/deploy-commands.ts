import { REST, Routes } from 'discord.js';
import { config as loadEnv } from 'dotenv';
import { readdirSync } from 'fs';
import { join } from 'path';
import type { BotCommand } from './types';

loadEnv();

async function deployCommands(): Promise<void> {
  const token = process.env.TOKEN;
  const clientId = process.env.CLIENT_ID;
  const guildId = process.env.GUILD_ID;

  if (!token || !clientId || !guildId) {
    throw new Error('TOKEN, CLIENT_ID ve GUILD_ID zorunludur.');
  }

  const commands: any[] = [];
  const commandFiles = readdirSync(join(__dirname, 'commands')).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      const command = (await import(join(__dirname, 'commands', file))).default as BotCommand;
      if (command && command.data) {
        commands.push(command.data.toJSON());
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Komut yüklenirken hata (${file}):`, error);
    }
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    // eslint-disable-next-line no-console
    console.log(`${commands.length} komut kaydediliyor...`);

    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });

    // eslint-disable-next-line no-console
    console.log('✅ Komutlar başarıyla kaydedildi!');
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Komut kaydı hatası:', error);
    process.exitCode = 1;
  }
}

void deployCommands();
