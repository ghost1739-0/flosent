import { ActivityType } from 'discord.js';
import type { BotEvent } from '../types';

export const name = 'ready';
export const once = true;

export async function execute(client: import('discord.js').Client): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`Bot altyapı modunda hazır: ${client.user?.tag ?? 'Bilinmiyor'}`);
  client.user?.setPresence({
    activities: [{ name: 'Altyapı modu', type: ActivityType.Playing }],
    status: 'online',
  });
}

export default { name, once, execute } satisfies BotEvent;