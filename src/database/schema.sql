-- Aktiflik Logs
CREATE TABLE IF NOT EXISTS aktiflik_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  checked_at TEXT NOT NULL,
  checked_date TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aktiflik_unique ON aktiflik_logs(discord_id, checked_date);

-- Aktiflik Sessions
CREATE TABLE IF NOT EXISTS aktiflik_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  target_role_id TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  active INTEGER DEFAULT 1
);

-- Aktiflik Session Participants
CREATE TABLE IF NOT EXISTS aktiflik_session_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  discord_id TEXT NOT NULL,
  username TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  UNIQUE(session_id, discord_id)
);

-- Aktiflik Member Status (consecutive misses)
CREATE TABLE IF NOT EXISTS aktiflik_member_status (
  discord_id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  consecutive_misses INTEGER DEFAULT 0,
  total_misses INTEGER DEFAULT 0,
  last_seen_at TEXT,
  updated_at TEXT NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_aktiflik_sessions_active ON aktiflik_sessions(active);
CREATE INDEX IF NOT EXISTS idx_aktiflik_participants_session ON aktiflik_session_participants(session_id);
