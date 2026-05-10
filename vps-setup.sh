#!/bin/bash
# ============================================================
#  MA ERP-CRM — VPS Setup Script
#  Ubuntu 24.04/26.04 LTS
#  Run as root or a sudo user:  bash vps-setup.sh
# ============================================================
set -euo pipefail
APP_DIR="/home/deploy/apps/ma-erp"
WEB_ROOT="/var/www/ma-erp"
PM2_NAME="ma-erp-api"
DEPLOY_USER="deploy"
GITHUB_REPO="https://github.com/filefos/ma-erp-crm.git"
SERVER_IP="187.127.77.150"

echo "================================================================"
echo " Step 1 — System packages"
echo "================================================================"
apt-get update -qq
apt-get install -y curl git nginx certbot python3-certbot-nginx postgresql postgresql-contrib ufw

echo "================================================================"
echo " Step 2 — Node.js 24 + pnpm"
echo "================================================================"
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt-get install -y nodejs
npm install -g pnpm pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "================================================================"
echo " Step 3 — Deploy user"
echo "================================================================"
id -u $DEPLOY_USER &>/dev/null || useradd -m -s /bin/bash $DEPLOY_USER
mkdir -p "$APP_DIR" "$WEB_ROOT"
chown -R $DEPLOY_USER:$DEPLOY_USER "$APP_DIR" "$WEB_ROOT"

echo "================================================================"
echo " Step 4 — PostgreSQL database + user"
echo "================================================================"
DB_PASS=$(openssl rand -hex 24)
sudo -u postgres psql -c "CREATE USER erp_user WITH PASSWORD '$DB_PASS';" 2>/dev/null || echo "(user exists)"
sudo -u postgres psql -c "CREATE DATABASE erp_db OWNER erp_user;" 2>/dev/null || echo "(db exists)"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_user;" 2>/dev/null || true
echo "  DB password generated: $DB_PASS"
echo "  DATABASE_URL=postgresql://erp_user:$DB_PASS@localhost:5432/erp_db"

echo "================================================================"
echo " Step 5 — Clone repository"
echo "================================================================"
if [ -d "$APP_DIR/.git" ]; then
  echo " Repo already cloned — pulling latest..."
  sudo -u $DEPLOY_USER git -C "$APP_DIR" pull
else
  sudo -u $DEPLOY_USER git clone "$GITHUB_REPO" "$APP_DIR"
fi

echo "================================================================"
echo " Step 6 — Create .env file (EDIT THIS BEFORE CONTINUING)"
echo "================================================================"
SESSION_SECRET=$(openssl rand -hex 64)
DEPLOY_SECRET=$(openssl rand -hex 32)
cat > "$APP_DIR/.env" << ENVEOF
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://erp_user:${DB_PASS}@localhost:5432/erp_db
SESSION_SECRET=${SESSION_SECRET}
ALLOWED_ORIGIN=http://${SERVER_IP}
DEPLOY_SECRET=${DEPLOY_SECRET}
LOG_LEVEL=info

# ─── SMTP (fill in before starting) ─────────────────────
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=

# ─── WhatsApp (optional) ─────────────────────────────────
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=

# ─── Expo Push (optional) ────────────────────────────────
EXPO_ACCESS_TOKEN=

# ─── Object storage ──────────────────────────────────────
PRIVATE_OBJECT_DIR=/var/erp/private
PUBLIC_OBJECT_SEARCH_PATHS=/var/erp/public
ENVEOF
chmod 600 "$APP_DIR/.env"
mkdir -p /var/erp/private /var/erp/public
chown -R $DEPLOY_USER:$DEPLOY_USER /var/erp
echo "  .env created at $APP_DIR/.env"
echo "  DEPLOY_SECRET=$DEPLOY_SECRET  (save this for GitHub Actions)"

echo "================================================================"
echo " Step 7 — Install dependencies + build"
echo "================================================================"
cd "$APP_DIR"
sudo -u $DEPLOY_USER pnpm install --frozen-lockfile
sudo -u $DEPLOY_USER pnpm run build

echo "================================================================"
echo " Step 8 — Apply database schema + seed"
echo "================================================================"
cd "$APP_DIR"
sudo -u $DEPLOY_USER bash -c "set -a; source .env; set +a; pnpm --filter @workspace/db run push"
echo ""
echo "  !! Do you want to seed the database with companies + super admin?"
echo "     Run manually if yes:  sudo -u deploy bash -c 'cd $APP_DIR && set -a && source .env && set +a && pnpm --filter @workspace/scripts run reset'"

echo "================================================================"
echo " Step 9 — Copy frontend to web root"
echo "================================================================"
cp -r "$APP_DIR/artifacts/erp-crm/dist/public/." "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"

echo "================================================================"
echo " Step 10 — Nginx config"
echo "================================================================"
cat > /etc/nginx/sites-available/ma-erp << NGINXEOF
server {
    listen 80;
    server_name ${SERVER_IP};

    # Gzip
    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
    gzip_min_length 1024;

    # Frontend (static files)
    root ${WEB_ROOT};
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Immutable JS/CSS assets (hashed filenames)
    location ~* \.(js|css|woff2|woff|ttf|png|jpg|svg|ico)\$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API reverse proxy
    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
        client_max_body_size 30M;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/ma-erp /etc/nginx/sites-enabled/ma-erp
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  Nginx configured."

echo "================================================================"
echo " Step 11 — PM2 process"
echo "================================================================"
cat > "$APP_DIR/pm2.config.cjs" << PM2EOF
module.exports = {
  apps: [{
    name: "${PM2_NAME}",
    script: "artifacts/api-server/dist/index.mjs",
    cwd: "${APP_DIR}",
    interpreter: "node",
    interpreter_args: "--enable-source-maps",
    env_file: ".env",
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: "512M",
    error_file: "/var/log/ma-erp/err.log",
    out_file: "/var/log/ma-erp/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss"
  }]
};
PM2EOF

mkdir -p /var/log/ma-erp
chown $DEPLOY_USER:$DEPLOY_USER /var/log/ma-erp

sudo -u $DEPLOY_USER pm2 start "$APP_DIR/pm2.config.cjs"
sudo -u $DEPLOY_USER pm2 save
echo "  PM2 started."

echo "================================================================"
echo " Step 12 — Firewall"
echo "================================================================"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable
echo "  UFW rules applied."

echo ""
echo "================================================================"
echo "  DONE!  Access your ERP at:  http://${SERVER_IP}"
echo "================================================================"
echo ""
echo "  Useful commands:"
echo "    pm2 logs $PM2_NAME          — live API logs"
echo "    pm2 restart $PM2_NAME       — restart API"
echo "    pm2 status                  — process list"
echo "    nginx -t && nginx -s reload — reload nginx"
echo ""
echo "  To seed the database (first time only):"
echo "    sudo -u deploy bash -c 'cd $APP_DIR && set -a && source .env && set +a && pnpm --filter @workspace/scripts run reset'"
echo ""
echo "  DEPLOY_SECRET (for GitHub Actions auto-deploy):"
echo "    $DEPLOY_SECRET"
echo "================================================================"
