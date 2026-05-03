import type { BotEvent } from '../types';

export const name = 'messageCreate';

export async function execute(): Promise<void> {
  return;
}

export default { name, execute } satisfies BotEvent;