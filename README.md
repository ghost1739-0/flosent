# FlosEnt Discord Bot

FiveM GunRP ekibi için geliştirilmiş Discord botu. Aktiflik kontrolü, ban yönetimi, oyun oturumları ve farm takibi gibi özellikleri içerir.

## Özellikler

- 🎮 **In-Game Oturumları** - Oyun oturumları başlatın ve katılımcıları yönetin (Max 20 kişi)
- ✅ **Aktiflik Kontrolü** - Üyeleri aktifliğini onaylaması için çağırın
- 🔨 **Ban Yönetimi** - Kullanıcıları banla, unban yap ve ban listesini görüntüle
- ⏱️ **Timeout** - Kullanıcılara zaman aşımı uygula
- 👢 **Kick** - Kullanıcıları sunucudan at
- 🌾 **Farm Sistemi** - Farm leaderboardını takip et ve farm kaydı tut

## Kurulum

### 1. Repository'i Klonla

```bash
git clone <repository-url>
cd flosent
```

### 2. Bağımlılıkları Yükle

```bash
npm install
```

### 3. Veritabanı Başlat

```bash
npm run db:init
```

### 4. Ortam Değişkenlerini Ayarla

`.env` dosyasını listeledeki bilgilerle doldur:

```env
TOKEN=your_bot_token_here
CLIENT_ID=your_client_id_here
GUILD_ID=your_guild_id_here
AKTIFLIK_CHANNEL_ID=channel_id
AKTIFLIK_ROLE_ID=role_id
FARM_CHANNEL_ID=channel_id
FARMVER_CHANNEL_ID=channel_id
INGAME_CHANNEL_ID=channel_id
```

### 5. Komutları Deploy Et

```bash
npm run deploy
```

### 6. Botu Başla

**Geliştirme Modu:**
```bash
npm run dev
```

**Prodüksiyon Modu:**
```bash
npm run build
npm start
```

## Komutlar

### 🎮 In-Game Oturumları
- `/ingame` - Yeni bir oyun oturumu başlat

### ✅ Aktiflik
- `/aktiflik` - Aktiflik kontrolü başlat

### 🔨 Ban Yönetimi
- `/ban <kullanıcı> <sebep>` - Kullanıcıyı banla
- `/banliste` - Aktif ban listesini görüntüle
- `/banunban` - Banlı kullanıcıyı unban yap

### ⏱️ Moderasyon
- `/timeout <kullanıcı> <sure>` - Kullanıcıya timeout uygula
- `/kick <kullanıcı> [sebep]` - Kullanıcıyı sunucudan at

### 🌾 Farm
- `/farm` - Farm leaderboardını görüntüle
- `/farmver <miktar>` - Farm miktarı kaydet (FARMVER_CHANNEL_ID'de kullanılabilir)

## Render'de Dağıtım

### SQLite Veritabanı Kalıcılığı

Render free tier'de daimi disk desteği yoktur. Kalıcı disk bağlamak için:

1. Render Dashboard'da projenize gidin
2. "Resources" kısmından "Disks" seçeneğini açın
3. İki seçeneğiniz var:

**Seçenek 1: Render Persistent Disk ($1/ay)**
- Otomatik olarak `/data` klasörüne bağlanacaktır
- SQLite veritabanı kalıcı olarak saklanacaktır
- Önerilir

**Seçenek 2: Turso Cloud SQLite (Ücretsiz)**
- Turso.tech adresinde ücretsiz bir hesap oluşturun
- SQLite dosyasını Turso'ya taşıyabilirsiniz

### Kurulum Adımları

1. Render'de yeni bir **Worker** hizmeti oluşturun
2. Repoyu bağlayın veya `render.yaml`'ı yükleyin
3. Persistent disk ekleyin (önerilir)
4. Ortam değişkenlerini ayarlayın
5. Deploy edin

```bash
# Render otomatik olarak aşağıdaki komutu çalıştıracaktır:
npm install && npm run build && npm run db:init && npm start
```

## Teknoloji Yığını

- **discord.js** v14.17.3 - Discord API client
- **TypeScript** 5.9.3 - Type-safe JavaScript
- **SQLite** (better-sqlite3) - Hafif veritabanı
- **Node.js** 18+ - Runtime ortamı

## Lisans

MIT

## Destek

Sorunlarla karşılaşırsanız lütfen GitHub issues'da rapor edin.
