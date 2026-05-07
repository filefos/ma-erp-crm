#!/usr/bin/env bash
set -e
APP_DIR="/home/deploy/apps/ma-erp"
WEB_ROOT="/var/www/ma-erp"
PM2_NAME="ma-erp-api"
DEPLOY_SECRET="0d1a95ed3a4a67ec0282d2bc9685bee4d2880c09662a2470e4b269751c485106"
SESSION_SECRET="3548197a0a7407780ce1a8e996da63d67f2c7cd2a3efa01ad5644d8458e35d7b71e9072fda474877a13ce58b4cb2cea5"

echo "====== MA ERP-CRM VPS Fix ======"
cd "$APP_DIR"

# ── 1. Find working DATABASE_URL ──────────────────────────────────
echo "[1/6] Testing database passwords..."
DB_URL=""
for PASS in "ErpMax2024" "QR8+4BDo2;U4Jsf.bdlkFjgh73" "STRONG"; do
  if psql "postgresql://erp_user:${PASS}@localhost:5432/ma_erp" \
      -c "SELECT 1;" > /dev/null 2>&1; then
    DB_URL="postgresql://erp_user:${PASS}@localhost:5432/ma_erp"
    echo "  ✓ Password works: ${PASS}"
    break
  else
    echo "  ✗ Password failed: ${PASS}"
  fi
done

if [ -z "$DB_URL" ]; then
  echo "  Trying postgres superuser to reset password..."
  sudo -u postgres psql -c "ALTER USER erp_user WITH PASSWORD 'ErpMax2024';" 2>/dev/null && \
    DB_URL="postgresql://erp_user:ErpMax2024@localhost:5432/ma_erp" && \
    echo "  ✓ Password reset to ErpMax2024"
fi

if [ -z "$DB_URL" ]; then
  echo "ERROR: Could not connect to database. Check PostgreSQL is running:"
  echo "  sudo systemctl status postgresql"
  exit 1
fi

# ── 2. Write correct .env ─────────────────────────────────────────
echo "[2/6] Writing .env..."
cat > "$APP_DIR/.env" << ENV
DATABASE_URL=${DB_URL}
SESSION_SECRET=${SESSION_SECRET}
PORT=8080
NODE_ENV=production
DEPLOY_SECRET=${DEPLOY_SECRET}
ENV
echo "  ✓ .env written"

# ── 3. Build frontend ─────────────────────────────────────────────
echo "[3/6] Building frontend (this takes ~60s)..."
pnpm --filter @workspace/erp-crm run build 2>&1 | tail -3
echo "  ✓ Frontend built"

# ── 4. Copy dist to nginx root ────────────────────────────────────
echo "[4/6] Publishing frontend to $WEB_ROOT..."
mkdir -p "$WEB_ROOT"
cp -r "$APP_DIR/artifacts/erp-crm/dist/." "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
echo "  ✓ $(ls $WEB_ROOT | wc -l) files copied"

# ── 5. Fix nginx config ───────────────────────────────────────────
echo "[5/6] Fixing nginx..."
cat > /etc/nginx/sites-available/ma-erp << 'NGINX'
server {
    listen 80;
    server_name _;

    location /api/ {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
        client_max_body_size 30m;
    }

    root /var/www/ma-erp;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
NGINX
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
ln -sf /etc/nginx/sites-available/ma-erp /etc/nginx/sites-enabled/ma-erp 2>/dev/null || true
nginx -t && systemctl reload nginx
echo "  ✓ nginx reloaded"

# ── 6. Restart API with PM2 ───────────────────────────────────────
echo "[6/6] Restarting API..."
pm2 delete "$PM2_NAME" 2>/dev/null || true
pm2 start "$APP_DIR/artifacts/api-server/dist/index.mjs" \
  --name "$PM2_NAME" \
  --cwd "$APP_DIR" \
  --node-args="--enable-source-maps"
pm2 save

sleep 6

# ── Result ────────────────────────────────────────────────────────
echo ""
echo "====== Results ======"
pm2 status
echo -n "API:      "; curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost:8080/api/healthz; echo
echo -n "Frontend: "; curl -s -o /dev/null -w "HTTP %{http_code}" http://localhost/; echo
echo "====================="
