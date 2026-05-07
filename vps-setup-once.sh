#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  MA ERP-CRM — ONE-TIME VPS SETUP
#  Run this ONCE on your VPS as root.
#  After this, every "git push vps main" from Replit auto-deploys.
# ═══════════════════════════════════════════════════════════════════
set -e

APP_DIR="/home/deploy/apps/ma-erp"
REPO_DIR="/home/deploy/repos/ma-erp.git"
PM2_NAME="ma-erp-api"
NODE_ENV="production"

# ── 1. Add Replit's SSH public key ──────────────────────────────────
echo ""
echo "Step 1: Authorizing Replit SSH key..."
mkdir -p ~/.ssh && chmod 700 ~/.ssh
REPLIT_KEY="ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIG/7F4DWVshMdei36hN510pzZpIroovSMy19WBTJgRCn replit-deploy"
if ! grep -qF "$REPLIT_KEY" ~/.ssh/authorized_keys 2>/dev/null; then
  echo "$REPLIT_KEY" >> ~/.ssh/authorized_keys
  chmod 600 ~/.ssh/authorized_keys
  echo "✓ Replit key added"
else
  echo "✓ Replit key already present"
fi

# ── 2. Create bare git repository ──────────────────────────────────
echo ""
echo "Step 2: Creating bare git repo at $REPO_DIR..."
mkdir -p "$REPO_DIR"
git init --bare "$REPO_DIR"
echo "✓ Bare repo created"

# ── 3. Write the post-receive deploy hook ──────────────────────────
echo ""
echo "Step 3: Writing post-receive hook..."
cat > "$REPO_DIR/hooks/post-receive" << 'HOOK'
#!/bin/bash
# Auto-deploy hook — runs every time Replit pushes to this repo

APP_DIR="/home/deploy/apps/ma-erp"
PM2_NAME="ma-erp-api"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  MA ERP-CRM — Auto Deploy                    ║"
echo "╚══════════════════════════════════════════════╝"

# Checkout latest code into app dir
mkdir -p "$APP_DIR"
GIT_WORK_TREE="$APP_DIR" GIT_DIR="$(pwd)" git checkout -f main
echo "✓ Code checked out"

cd "$APP_DIR"

# Install dependencies (fast — uses lockfile)
echo ""
echo "→ Installing dependencies..."
export PATH="/root/.local/share/pnpm:$PATH"
export PNPM_HOME="/root/.local/share/pnpm"
pnpm install --frozen-lockfile
echo "✓ Dependencies installed"

# Build frontend
echo ""
echo "→ Building frontend..."
pnpm --filter @workspace/erp-crm run build
echo "✓ Frontend built"

# Build API server
echo ""
echo "→ Building API server..."
pnpm --filter @workspace/api-server run build
echo "✓ API server built"

# Restart PM2
echo ""
echo "→ Restarting PM2..."
if pm2 list | grep -q "$PM2_NAME"; then
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
echo "╔══════════════════════════════════════════════╗"
echo "║  Deploy complete! Live at 187.127.77.150     ║"
echo "╚══════════════════════════════════════════════╝"
echo ""
HOOK

chmod +x "$REPO_DIR/hooks/post-receive"
echo "✓ Hook written and made executable"

# ── 4. Ensure app dir exists ────────────────────────────────────────
mkdir -p "$APP_DIR"

# ── 5. Make sure pnpm is on PATH in non-interactive shells ─────────
echo ""
echo "Step 4: Verifying pnpm..."
export PATH="/root/.local/share/pnpm:$PATH"
if command -v pnpm &>/dev/null; then
  echo "✓ pnpm found: $(pnpm --version)"
else
  echo "Installing pnpm..."
  npm install -g pnpm
  echo "✓ pnpm installed"
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  VPS setup complete!"
echo ""
echo "  Bare repo:  $REPO_DIR"
echo "  App dir:    $APP_DIR"
echo "  PM2 name:   $PM2_NAME"
echo ""
echo "  Now run these two commands IN REPLIT:"
echo ""
echo "  git remote add vps root@187.127.77.150:$REPO_DIR"
echo "  git push vps main"
echo "═══════════════════════════════════════════════════════"
echo ""
