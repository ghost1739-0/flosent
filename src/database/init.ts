import { db } from './db';

async function main(): Promise<void> {
  await db.close();
  console.log('✅ MongoDB bağlantısı ve indeksler hazır.');
}

void main().catch((error) => {
  console.error('Veritabanı başlatma hatası:', error);
  process.exitCode = 1;
});
