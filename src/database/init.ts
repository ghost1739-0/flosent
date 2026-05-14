const sqlite3 = require('sqlite3').verbose();
import { dirname, resolve } from 'path';
import { readFileSync } from 'fs';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const dbDir = join(process.cwd(), 'data');
const dbPath = resolve(dbDir, 'database.sqlite');

// Create data directory if it doesn't exist
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

try {
  const parentDir = dirname(dbPath);
  if (!existsSync(parentDir)) {
    mkdirSync(parentDir, { recursive: true });
  }
} catch (error) {
  console.error('Veritabanı dizini oluşturulamadı:', error);
  process.exit(1);
}

const db = new sqlite3.Database(dbPath, (error: Error | null) => {
  if (error) {
    console.error('Veritabanı açılamadı:', error);
    process.exit(1);
  }
});

// Read and execute schema
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
const statements = schema.split(';').filter((s) => s.trim());

db.serialize(() => {
  for (const statement of statements) {
    if (!statement.trim()) {
      continue;
    }

    db.exec(statement, (error: Error | null) => {
      if (error) {
        // eslint-disable-next-line no-console
        console.error('Şema çalıştırma hatası:', error);
      }
    });
  }

  db.close((error: Error | null) => {
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Veritabanı kapatma hatası:', error);
      process.exit(1);
      return;
    }

    console.log('✅ Database initialized successfully at:', dbPath);
  });
});
