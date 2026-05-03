import { readdirSync } from 'fs';
import { join } from 'path';
import type { BotClient, BotCommand } from '../types';

export async function loadCommands(client: BotClient): Promise<void> {
  const commandsPath = join(__dirname, '..', 'commands');
  const commandFiles = readdirSync(commandsPath).filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

  for (const file of commandFiles) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const command = (await import(join(commandsPath, file))).default as BotCommand;
      if (command && 'data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        // eslint-disable-next-line no-console
        console.log(`✅ Komut yüklendi: ${command.data.name}`);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(`Komut yüklenirken hata (${file}):`, error);
    }
  }
}
