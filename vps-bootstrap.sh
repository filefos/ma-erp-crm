#!/bin/bash
# ─────────────────────────────────────────────────────────────────
#  MA ERP-CRM · VPS One-Time Bootstrap
#
#  Run this ONCE from your VPS console.
#  Access it via your hosting provider's browser-based terminal
#  (Hetzner Cloud Console / DigitalOcean Console / cPanel Terminal).
#
#  After this runs, every git push to GitHub auto-deploys here.
# ─────────────────────────────────────────────────────────────────

set -e

# ── SET THESE BEFORE RUNNING ─────────────────────────────────────
GH_PAT="${GH_PAT:-}"           # Your GitHub personal access token
APP_DIR="/home/deploy/apps/ma-erp"
PM2_NAME="ma-erp-api"
DEPLOY_SECRET="0d1a95ed3a4a67ec0282d2bc9685bee4d2880c09662a2470e4b269751c485106"
# ─────────────────────────────────────────────────────────────────

if [ -z "$GH_PAT" ]; then
  echo "ERROR: Set GH_PAT before running: export GH_PAT=your_token"
  exit 1
fi

export PATH="/root/.local/share/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
export PNPM_HOME="/root/.local/share/pnpm"

echo ""
echo "══════════════════════════════════════════════"
echo "  MA ERP-CRM VPS Bootstrap"
echo "══════════════════════════════════════════════"

mkdir -p "$APP_DIR"
cd "$APP_DIR"

echo "→ Connecting to GitHub..."
git init -q 2>/dev/null || true
git remote remove origin 2>/dev/null || true
git remote add origin "https://filefos:${GH_PAT}@github.com/filefos/ma-erp.git"
git fetch origin
git reset --hard origin/main
echo "✓ Code pulled from GitHub"

echo "→ Installing dependencies..."
pnpm install --frozen-lockfile
echo "✓ Dependencies installed"

echo "→ Building frontend..."
pnpm --filter @workspace/erp-crm run build
echo "✓ Frontend built"

echo "→ Building API server..."
pnpm --filter @workspace/api-server run build
echo "✓ API built"

echo "→ Saving DEPLOY_SECRET to .env..."
touch .env
grep -v "^DEPLOY_SECRET=" .env > .env.tmp && mv .env.tmp .env
echo "DEPLOY_SECRET=${DEPLOY_SECRET}" >> .env
echo "✓ Secret saved"

echo "→ Restarting PM2..."
if pm2 list 2>/dev/null | grep -q "$PM2_NAME"; then
  pm2 restart "$PM2_NAME"
else
  pm2 start "$APP_DIR/artifacts/api-server/dist/index.mjs" \
    --name "$PM2_NAME" \
    --node-args="--enable-source-maps" \
    --env production
fi
pm2 save
echo "✓ PM2 restarted"

echo ""
echo "══════════════════════════════════════════════"
echo "  ✓ Bootstrap complete!"
echo ""
echo "  Next steps:"
echo "  1. Add DEPLOY_SECRET to GitHub Actions secrets:"
echo "     https://github.com/filefos/ma-erp/settings/secrets/actions/new"
echo "     Name:  DEPLOY_SECRET"
echo "     Value: ${DEPLOY_SECRET}"
echo ""
echo "  After that: every push to GitHub = auto-deploy here"
echo "══════════════════════════════════════════════"
echo ""
