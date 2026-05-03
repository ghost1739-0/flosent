import type { BotEvent } from '../types';

export const name = 'guildMemberAdd';

export async function execute(member: import('discord.js').GuildMember): Promise<void> {
  void member;
}

export default { name, execute } satisfies BotEvent;