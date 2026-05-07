#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# MA ERP-CRM — VPS Deploy Script
# Run this ON the VPS: bash deploy-vps.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/home/deploy/apps/ma-erp"
FRONTEND_DEST="$APP_DIR/artifacts/erp-crm/dist/public"
API_DEST="$APP_DIR/artifacts/api-server/dist"
PM2_NAME="ma-erp-api"

echo ""
echo "══════════════════════════════════════════════"
echo "  MA ERP-CRM — Deploy"
echo "══════════════════════════════════════════════"

# 1. Navigate to app dir
cd "$APP_DIR"
echo "✓ Working in $APP_DIR"

# 2. Install/update Node dependencies (only if package.json changed)
echo ""
echo "→ Installing dependencies..."
pnpm install --frozen-lockfile 2>/dev/null || pnpm install
echo "✓ Dependencies ready"

# 3. Build frontend
echo ""
echo "→ Building frontend..."
pnpm --filter @workspace/erp-crm run build
echo "✓ Frontend built → $FRONTEND_DEST"

# 4. Build API server
echo ""
echo "→ Building API server..."
pnpm --filter @workspace/api-server run build
echo "✓ API server built → $API_DEST"

# 5. Restart PM2
echo ""
echo "→ Restarting PM2 process '$PM2_NAME'..."
pm2 restart "$PM2_NAME" || pm2 start "$API_DEST/index.mjs" --name "$PM2_NAME" --node-args="--enable-source-maps"
pm2 save
echo "✓ PM2 restarted"

echo ""
echo "══════════════════════════════════════════════"
echo "  Deploy complete!"
echo "  Frontend: $FRONTEND_DEST"
echo "  API:      $API_DEST/index.mjs"
echo "══════════════════════════════════════════════"
echo ""
