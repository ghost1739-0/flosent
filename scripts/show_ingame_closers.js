const sqlite3 = require('sqlite3').verbose();
const { join } = require('path');

try {
  const dbPath = join(process.cwd(), 'data', 'database.sqlite');
  const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READONLY);

  db.all(
    `
    SELECT id, action, user_id, username, details, logged_at
    FROM bot_logs
    WHERE action = 'ingame_oturumu_kapatildi'
    ORDER BY logged_at DESC
    LIMIT 20
  `,
    [],
    (err, rows) => {
      if (err) {
        console.error('Error reading database:', err);
        process.exit(2);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('No ingame_oturumu_kapatildi logs found.');
        db.close();
        process.exit(0);
        return;
      }

      console.log('Recent ingame_oturumu_kapatildi logs:');
      for (const r of rows) {
        console.log(`- [${r.logged_at}] ${r.username} (${r.user_id}) -> ${r.details || '(no details)'} (log id ${r.id})`);
      }
      db.close();
    }
  );
} catch (err) {
  console.error('Error reading database:', err);
  process.exit(2);
}
