const Database = require('better-sqlite3');
const { join } = require('path');

try {
  const dbPath = join(process.cwd(), 'data', 'database.db');
  const db = new Database(dbPath, { readonly: true });

  const stmt = db.prepare(`
    SELECT id, action, user_id, username, details, logged_at
    FROM bot_logs
    WHERE action = 'ingame_oturumu_kapatildi'
    ORDER BY logged_at DESC
    LIMIT 20
  `);

  const rows = stmt.all();
  if (!rows || rows.length === 0) {
    console.log('No ingame_oturumu_kapatildi logs found.');
    process.exit(0);
  }

  console.log('Recent ingame_oturumu_kapatildi logs:');
  for (const r of rows) {
    console.log(`- [${r.logged_at}] ${r.username} (${r.user_id}) -> ${r.details || '(no details)'} (log id ${r.id})`);
  }
  db.close();
} catch (err) {
  console.error('Error reading database:', err);
  process.exit(2);
}
