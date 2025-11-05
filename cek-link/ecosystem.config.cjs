
module.exports = {
  apps: [{
    name: 'cek-link',
    script: './index.js',
    instances: 1, // PENTING: Harus 1 untuk bot dengan cron dan file locking
    exec_mode: 'fork', // Bukan cluster mode
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    env: {
      NODE_ENV: 'production'
    },
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 10000,
    shutdown_with_message: true,
    // Auto restart on crash
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    // Cron restart (optional - setiap hari jam 3 pagi)
    cron_restart: '0 3 * * *',
    // Memory monitoring
    max_memory_restart: '512M'
  }]
};
