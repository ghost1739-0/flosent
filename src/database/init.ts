import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbDir = join(process.cwd(), 'data');
const dbPath = join(dbDir, 'database.db');

// Create data directory if it doesn't exist
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Read and execute schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
const statements = schema.split(';').filter((s) => s.trim());

for (const statement of statements) {
  if (statement.trim()) {
    try {
      db.exec(statement);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Şema çalıştırma hatası:', error);
    }
  }
}

db.close();
console.log('✅ Database initialized successfully at:', dbPath);
