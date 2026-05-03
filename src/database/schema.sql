-- Aktiflik Logs
CREATE TABLE IF NOT EXISTS aktiflik_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  checked_at TEXT NOT NULL
);

-- Ban Logs
CREATE TABLE IF NOT EXISTS bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  reason TEXT NOT NULL,
  banned_by TEXT NOT NULL,
  banned_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

-- Farm Logs
CREATE TABLE IF NOT EXISTS farm_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  amount INTEGER NOT NULL,
  given_at TEXT NOT NULL
);

-- In-Game Sessions
CREATE TABLE IF NOT EXISTS ingame_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  participants TEXT DEFAULT '[]',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

-- Bot Logs (for audit trail)
CREATE TABLE IF NOT EXISTS bot_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  user_id TEXT NOT NULL,
  username TEXT NOT NULL,
  details TEXT,
  logged_at TEXT NOT NULL
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bans_discord_id ON bans(discord_id);
CREATE INDEX IF NOT EXISTS idx_bans_active ON bans(active);
CREATE INDEX IF NOT EXISTS idx_farm_logs_discord_id ON farm_logs(discord_id);
CREATE INDEX IF NOT EXISTS idx_aktiflik_logs_discord_id ON aktiflik_logs(discord_id);
CREATE INDEX IF NOT EXISTS idx_ingame_sessions_active ON ingame_sessions(active);
