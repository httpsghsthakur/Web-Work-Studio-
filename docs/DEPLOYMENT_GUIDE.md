# Central ERP Command — Production Deployment Guide

## System Requirements
- Node.js 22.5+ or Node.js 24+ (utilizing native high-performance `node:sqlite`)
- Reverse Proxy: Nginx, Caddy, or Cloudflare Tunnel
- SSL Certificate (Let's Encrypt or Cloudflare TLS)
- Memory: 512 MB minimum, 2 GB recommended
- Storage: 10 GB SSD for high-write telemetry

---

## 1. Quick Start / Local Run

```bash
# 1. Install dependencies
npm install

# 2. Seed database with initial roles, plans, and schools
node --experimental-sqlite src/database/seed.js

# 3. Run automated verification test suite
node tests/run_all_tests.js

# 4. Start production server
node --experimental-sqlite src/server.js
```
The application will be running at `http://localhost:4000`.

---

## 2. Production Environment Variables (`.env`)

Create a `.env` file in the project root:

```env
PORT=4000
NODE_ENV=production
JWT_SECRET=central-command-ultra-secure-key-replace-in-production-892174
DB_PATH=/var/data/central_erp.sqlite
REPLAY_WINDOW_SECONDS=300
DEFAULT_GRACE_PERIOD_DAYS=7
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=120
```

---

## 3. Production Process Management (PM2)

Using PM2 ensures automatic restarts on system reboot or unhandled crashes:

```bash
# Install PM2 globally
npm install -g pm2

# Start Central ERP Command
pm2 start src/server.js --name "central-erp-command" --node-args="--experimental-sqlite"

# Save process list for startup on boot
pm2 save
pm2 startup
```

---

## 4. Reverse Proxy Configuration (Nginx)

Place this configuration in `/etc/nginx/sites-available/central-command.conf`:

```nginx
server {
    listen 80;
    server_name central.schools-erp.cloud;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name central.schools-erp.cloud;

    ssl_certificate /etc/letsencrypt/live/central.schools-erp.cloud/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/central.schools-erp.cloud/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Automated Database Backups

Set up an automated daily cron job to back up SQLite using the online backup command:

```bash
# /etc/cron.daily/backup-central-erp.sh
#!/bin/bash
BACKUP_DIR="/var/backups/central-erp"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
mkdir -p "$BACKUP_DIR"

sqlite3 /var/data/central_erp.sqlite ".backup '$BACKUP_DIR/central_erp_$TIMESTAMP.sqlite'"
# Keep last 30 days
find "$BACKUP_DIR" -type f -name "*.sqlite" -mtime +30 -delete
```

Ensure the script is executable:
```bash
chmod +x /etc/cron.daily/backup-central-erp.sh
```
