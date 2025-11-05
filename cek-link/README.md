# Bot Telegram Website Monitor

Bot Telegram untuk memantau status website secara otomatis dengan pengecekan berkala dan notifikasi real-time.

![Node.js](https://img.shields.io/badge/Node.js-20.x-green)
![License](https://img.shields.io/badge/license-ISC-blue)

## 📋 Fitur Utama

- ✅ **Monitoring Otomatis**: Pengecekan website setiap hari pada jam 8 pagi
- 🔍 **Pengecekan Manual**: Command untuk cek status website kapan saja
- 📊 **Status Detail**: Response time, HTTP status code, error detection
- 🚫 **Deteksi Blocking**: Identifikasi website yang diblokir (Internet Positif)
- 📱 **Smart URL Management**: Sistem cerdas untuk mengganti URL yang mirip
- 🔒 **Rate Limiting**: Perlindungan dari spam command (30 req/menit)
- 💾 **Data Persistence**: Konfigurasi dan hasil tersimpan dalam JSON
- 📁 **PHP Redirect Generator**: Buat folder redirect PHP otomatis
- 🌐 **IPv4 Priority**: Koneksi stabil dengan prioritas IPv4
- 📝 **Structured Logging**: Winston logger dengan rotating files

## 🚀 Quick Start

### Prerequisites

- Node.js 20.x atau lebih baru
- Akun Telegram Bot (dapatkan dari [@BotFather](https://t.me/botfather))
- Telegram Chat ID

### Instalasi

1. Clone repository
```bash
git clone https://github.com/tentangblockchain/cek-link.git
cd cek-link
```

2. Install dependencies
```bash
npm install
```

3. Setup environment variables
```bash
cp .env.example .env
```

4. Edit `.env` dengan credentials Anda:
```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
# Single admin
TELEGRAM_CHAT_ID=your_chat_id_here
# Or multiple admins (comma-separated)
TELEGRAM_CHAT_ID=123456789,987654321,555666777
LOG_LEVEL=info
CHECK_INTERVAL_HOURS=24
REQUEST_TIMEOUT=25000
MAX_RETRIES=2
DELAY_BETWEEN_CHECKS=3
```

5. Jalankan bot
```bash
node index.js
```

## 📖 Command List

### Command Dasar (gunakan prefix `!`)

| Command | Deskripsi | Contoh |
|---------|-----------|--------|
| `!add` | Tambah website baru | `!add binance_url binance.com` |
| `!edit` | Edit URL website | `!edit binance_url newdomain.com` |
| `!del` | Hapus website | `!del binance_url` |
| `!list` | Lihat semua website | `!list` |
| `!check` | Cek status 1 website | `!check binance_url` |
| `!checkall` | Cek semua website | `!checkall` |
| `!createphp` | Buat PHP redirect | `!createphp binance_url` |
| `!help` atau `/help` | Tampilkan bantuan | `!help` |

### Smart URL Replacement

Kirim URL langsung ke bot tanpa command, dan bot akan:
- Mencari website dengan nama/domain yang mirip
- Tawarkan opsi untuk mengganti URL yang sudah ada
- Atau tambahkan sebagai website baru

**Contoh:**
```
Kirim: https://newdomain.com/?ref=abc123
Bot: 🔄 URL Baru Terdeteksi!
     Apakah ingin mengganti "olddomain_url"?
```

## 🏗️ Struktur Project

```
cek-link/
├── index.js              # Main bot application
├── utils/
│   └── urlHelper.js      # URL parsing & validation utilities
├── private/
│   ├── config.json       # Website configuration (auto-generated)
│   └── check_results.json # Check results cache (auto-generated)
├── logs/
│   ├── combined.log      # All logs (auto-generated)
│   └── error.log         # Error logs only (auto-generated)
├── package.json          # Dependencies
├── .env                  # Environment variables (create from .env.example)
└── .env.example          # Environment template
```

## 🔧 Konfigurasi

### Environment Variables

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `TELEGRAM_BOT_TOKEN` | - | Token bot dari @BotFather |
| `TELEGRAM_CHAT_ID` | - | Chat ID Telegram Anda |
| `LOG_LEVEL` | `info` | Level logging (error/warn/info/debug) |
| `CHECK_INTERVAL_HOURS` | `24` | Interval auto check (jam) |
| `REQUEST_TIMEOUT` | `25000` | Timeout per request (ms) |
| `MAX_RETRIES` | `2` | Max retry untuk failed request |
| `DELAY_BETWEEN_CHECKS` | `3` | Delay antar pengecekan (detik) |

### config.json Structure

```json
{
  "websites": {
    "site1_url": "https://example.com",
    "site2_url": "https://example2.com?ref=abc"
  },
  "last_check_time": "2025-01-04 10:00:00 WIB",
  "version": "1.0"
}
```

## 🛡️ Security Features

- ✅ **Input Sanitization**: Mencegah path traversal attacks
- ✅ **Rate Limiting**: 30 commands per menit per user
- ✅ **Authorization**: Hanya chat ID terdaftar yang bisa akses
- ✅ **URL Validation**: Whitelist protocol (http/https only)
- ✅ **File Locking**: Atomic writes untuk config file
- ✅ **Error Handling**: Comprehensive error catching & logging

## 📊 Status Categories

| Status | Emoji | Deskripsi |
|--------|-------|-----------|
| `up` | ✅ | Website online (2xx response) |
| `blocked` | 🚫 | Blocked by ISP/Internet Positif |
| `redirect` | ↗️ | Redirect response (3xx) |
| `timeout` | ⏰ | Request timeout |
| `dns_error` | 🌐 | DNS resolution failed |
| `ssl_error` | 🔒 | SSL certificate issue |
| `error` | ❌ | Other errors |

## 🔄 Auto Checker

Bot secara otomatis mengecek semua website setiap hari jam **8 pagi WIB** dan mengirim notifikasi jika ada masalah:

```
🚨 Daily Check Alert

🚫 Blocked Sites (2):
• site1 - 200
• site2 - 200

⏰ Timeout Issues (1):
• site3 - N/A

📊 Summary: 47/50 sites healthy
🕐 Time: 2025-01-04 08:00:00 WIB
```

## 📝 Logging

Log files tersimpan di folder `./logs/`:
- `combined.log` - Semua log entries
- `error.log` - Error logs saja

**Log Rotation:**
- Max size: 5MB per file
- Max files: 5 rotating files

## 🤝 Contributing

Contributions are welcome! Silakan:
1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

ISC License - see LICENSE file for details

## 👨‍💻 Author

**Hokireceh**
- GitHub: [@tentangblockchain](https://github.com/tentangblockchain)

## 🙏 Acknowledgments

- [Telegraf](https://telegraf.js.org/) - Modern Telegram Bot Framework
- [Winston](https://github.com/winstonjs/winston) - Logging library
- [Axios](https://axios-http.com/) - HTTP client
- [node-cron](https://github.com/node-cron/node-cron) - Task scheduler

## 📞 Support

Jika ada pertanyaan atau issue, silakan:
- Open [GitHub Issue](https://github.com/tentangblockchain/cek-link/issues)
- Contact via Telegram: @cs_hokirecehbot

---

⭐ Jika project ini membantu, jangan lupa beri star!