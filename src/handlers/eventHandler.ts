import fs from 'fs';
import path from 'path';
import type { Client } from 'discord.js';
import type { BotEvent } from '../types';

function readEventFiles(directory: string): string[] {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const resolvedPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...readEventFiles(resolvedPath));
      continue;
    }

    if (/\.(js|ts)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      files.push(resolvedPath);
    }
  }

  return files;
}

export function loadEvents(client: Client, eventsDirectory = path.join(__dirname, '..', 'events')): void {
  const eventFiles = readEventFiles(eventsDirectory);

  for (const filePath of eventFiles) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const rawModule = require(filePath) as { default?: Partial<BotEvent> } & Partial<BotEvent>;
    const loadedEvent: Partial<BotEvent> = rawModule.default ?? rawModule;
    if (!loadedEvent.name || !loadedEvent.execute) {
      continue;
    }

    if (loadedEvent.once) {
      client.once(loadedEvent.name, (...args: unknown[]) => {
        if (loadedEvent.name === 'ready') {
          return loadedEvent.execute?.(client, ...args);
        }

        return loadedEvent.execute?.(...args);
      });
      continue;
    }

    client.on(loadedEvent.name, (...args: unknown[]) => loadedEvent.execute?.(...args));
  }
}