# MA ERP-CRM — Hostinger VPS (KVM 4) Deployment Guide

This guide deploys the **API server** (Node/Express) and the **web app**
(React/Vite static build) onto a single Hostinger VPS (Ubuntu 22.04 LTS),
fronted by Nginx with Let's Encrypt SSL, with PM2 keeping the API alive.

---

## 0. What you need before starting

| Item | Where to get it |
|---|---|
| Hostinger VPS KVM 4, Ubuntu 22.04 LTS | Hostinger panel → VPS → reinstall OS |
| Public IP of the VPS | Hostinger panel → VPS → Overview |
| A domain (e.g. `erp.yourcompany.com`) pointed at the VPS IP (A record) | Your domain registrar |
| Strong passwords for: `deploy` user, `erp_user` Postgres user, JWT secret | Generate with `openssl rand -base64 32` |
| SMTP / WhatsApp / object storage credentials (already in Replit secrets) | Copy from current Replit env |

---

## 1. SSH into the server (first time)

From your local machine:

```bash
ssh root@YOUR_VPS_IP
# password is in the Hostinger panel
```

> Once everything below is done, you will use `ssh deploy@erp.yourcompany.com` instead — root login will be disabled.

---

## 2. Base hardening (run as `root`)

```bash
# 2.1 Update everything
apt update && apt upgrade -y

# 2.2 Set timezone (UAE)
timedatectl set-timezone Asia/Dubai

# 2.3 Create a non-root deploy user
adduser deploy                       # set a strong password
usermod -aG sudo deploy

# 2.4 Copy your SSH key to the deploy user (run this from your laptop):
#     ssh-copy-id deploy@YOUR_VPS_IP
# Then back on the VPS, test it works in a SECOND terminal before continuing.

# 2.5 Disable root SSH and password auth
sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# 2.6 Firewall — allow only SSH + HTTP + HTTPS
apt install -y ufw
ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# 2.7 Fail2ban for brute-force SSH protection
apt install -y fail2ban
systemctl enable --now fail2ban
```

From now on, log in as the `deploy` user:

```bash
ssh deploy@YOUR_VPS_IP
```

---

## 3. Install runtime stack (as `deploy`, with `sudo`)

```bash
# 3.1 Node 20 LTS via NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs build-essential git

# 3.2 pnpm + PM2
sudo npm install -g pnpm@9 pm2

# 3.3 PostgreSQL 16
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql

# 3.4 Nginx + Certbot
sudo apt install -y nginx
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/bin/certbot
```

---

## 4. Set up the production database

```bash
sudo -u postgres psql <<'SQL'
CREATE USER erp_user WITH PASSWORD 'CHANGE_ME_STRONG_PASSWORD';
CREATE DATABASE ma_erp OWNER erp_user;
GRANT ALL PRIVILEGES ON DATABASE ma_erp TO erp_user;
SQL
```

> Postgres listens only on `localhost` by default — that is what we want.
> Do **not** open port 5432 in the firewall.

---

## 5. Get the project onto the server

Option A — clone from a private Git repo:

```bash
mkdir -p ~/apps && cd ~/apps
git clone git@github.com:YOUR_ORG/ma-erp.git
cd ma-erp
```

Option B — push from your machine over SSH:

```bash
# from your local machine, in the project root:
rsync -av --exclude node_modules --exclude .git --exclude dist \
  ./ deploy@YOUR_VPS_IP:~/apps/ma-erp/
```

---

## 6. Configure environment variables

Create `~/apps/ma-erp/.env.production` with the secrets below. **Use the
template `.env.production.example` shipped in the repo as a starting point.**

```bash
cd ~/apps/ma-erp
cp .env.production.example .env.production
nano .env.production    # fill every CHANGE_ME value
chmod 600 .env.production
```

Key values:

| Variable | Example | Notes |
|---|---|---|
| `NODE_ENV` | `production` | Required |
| `PORT` | `8080` | API port (kept on localhost) |
| `BASE_PATH` | `/` | Vite base path for the built bundle |
| `DATABASE_URL` | `postgres://erp_user:STRONG@127.0.0.1:5432/ma_erp` | |
| `JWT_SECRET` | 32+ random chars | `openssl rand -base64 48` |
| `COOKIE_DOMAIN` | `erp.yourcompany.com` | |
| `SMTP_*` | from your existing config | nodemailer |
| `WHATSAPP_ACCESS_TOKEN` | Meta token | optional |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` etc. | — | only needed if you keep using Replit Object Storage; otherwise switch to local disk uploads |

---

## 7. Install dependencies and build

```bash
cd ~/apps/ma-erp
pnpm install --frozen-lockfile
pnpm --filter @workspace/api-spec run codegen   # regenerate API client
pnpm --filter @workspace/api-server run build   # → artifacts/api-server/dist/index.mjs
PORT=8080 BASE_PATH=/ pnpm --filter @workspace/erp-crm run build
                                                # → artifacts/erp-crm/dist/public/
```

---

## 8. Push the database schema

```bash
cd ~/apps/ma-erp
DATABASE_URL="postgres://erp_user:STRONG@127.0.0.1:5432/ma_erp" \
  pnpm --filter @workspace/db run push-force
```

This creates every table from the Drizzle schema. The app starts with a
clean database — you'll create the first super-admin in step 11.

---

## 9. Start the API server with PM2

`ecosystem.config.cjs` is shipped in the repo root. Start it:

```bash
cd ~/apps/ma-erp
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup systemd -u deploy --hp /home/deploy   # follow the printed sudo command
```

Useful PM2 commands:

```bash
pm2 status              # see processes
pm2 logs ma-erp-api     # tail logs
pm2 restart ma-erp-api  # zero-downtime restart
pm2 stop ma-erp-api
pm2 monit               # live dashboard
```

---

## 10. Configure Nginx as the public reverse proxy

Copy the shipped template:

```bash
sudo cp ~/apps/ma-erp/deploy/nginx.conf /etc/nginx/sites-available/ma-erp
sudo sed -i 's/erp.yourcompany.com/YOUR_REAL_DOMAIN/g' /etc/nginx/sites-available/ma-erp
sudo ln -s /etc/nginx/sites-available/ma-erp /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

The template:
- serves the built React bundle from `~/apps/ma-erp/artifacts/erp-crm/dist/public`
- proxies `/api/*` to the PM2 API on `127.0.0.1:8080`
- enables gzip, long-lived asset caching, and security headers
- redirects HTTP → HTTPS once SSL is in place

---

## 11. Issue an SSL certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d erp.yourcompany.com -m you@yourcompany.com --agree-tos --redirect --no-eff-email
```

Certbot adds a cron job for auto-renewal. Verify with:

```bash
sudo certbot renew --dry-run
```

---

## 12. Create the first super-admin

You wiped the demo users earlier. To create the production admin, open a
psql shell once:

```bash
cd ~/apps/ma-erp
node -e "
const bcrypt = require('bcryptjs');
console.log(bcrypt.hashSync(process.argv[1], 10));
" 'YourStrongAdminPassword!'
# copy the output hash
```

```bash
sudo -u postgres psql ma_erp <<'SQL'
INSERT INTO companies (name, short_name, prefix, is_active)
VALUES ('PRIME MAX PREFAB HOUSES IND. LLC.', 'PMP', 'PMP', true);

INSERT INTO users (name, email, password_hash, role, permission_level, is_active, status, company_id)
VALUES ('Asif Latif', 'admin@erp.com', 'PASTE_BCRYPT_HASH_HERE', 'super_admin', 'super_admin', true, 'active', 1);

INSERT INTO user_company_access (user_id, company_id) VALUES (1, 1);
SQL
```

Then run `pnpm --filter @workspace/scripts run fix-roles` from the project
root to seed the standard role/permission matrix.

---

## 13. Verify

Open `https://erp.yourcompany.com` in a browser. You should see the login
page. Sign in with the credentials from step 12.

```bash
# Quick smoke test from the VPS itself:
curl -I https://erp.yourcompany.com
curl -s https://erp.yourcompany.com/api/healthz   # if a health route exists
pm2 status
sudo systemctl status nginx postgresql
```

---

## Day-2 operations

| Action | Command |
|---|---|
| Pull new code & redeploy | `cd ~/apps/ma-erp && git pull && pnpm install --frozen-lockfile && pnpm --filter @workspace/api-spec run codegen && pnpm --filter @workspace/api-server run build && PORT=8080 BASE_PATH=/ pnpm --filter @workspace/erp-crm run build && pm2 reload ma-erp-api` |
| Apply schema changes | `pnpm --filter @workspace/db run push-force` |
| Restart API | `pm2 restart ma-erp-api` |
| Restart Nginx | `sudo systemctl reload nginx` |
| Tail API logs | `pm2 logs ma-erp-api --lines 200` |
| Tail Nginx access | `sudo tail -f /var/log/nginx/access.log` |
| DB backup | `pg_dump -U erp_user ma_erp \| gzip > ~/backups/ma_erp_$(date +%F).sql.gz` |
| Restore | `gunzip < backup.sql.gz \| psql -U erp_user ma_erp` |

Schedule a nightly backup with cron:

```bash
crontab -e
# add:
15 2 * * * pg_dump -U erp_user ma_erp | gzip > /home/deploy/backups/ma_erp_$(date +\%F).sql.gz
```

---

## Final checks before going live

1. `https://` works and the certificate is valid for at least 80 days.
2. `http://` redirects to `https://`.
3. Login as the new super-admin works; both companies are accessible from the company switcher.
4. Create one record in each major module (lead, supplier, inventory item, employee) — confirm document numbering starts at 1.
5. PM2 shows `ma-erp-api` as `online` and `pm2 startup` was confirmed (so it auto-restarts on reboot — try `sudo reboot` once).
6. `ufw status` shows only 22, 80, 443 open.
7. `sudo grep -E 'PermitRootLogin|PasswordAuthentication' /etc/ssh/sshd_config` shows both are `no`.
8. Database backup cron entry exists (`crontab -l`).
9. SMTP credentials are correct — send a test email from the email module.
10. Disk usage healthy: `df -h`. KVM 4 ships with ~200 GB; keep `/home/deploy/backups` rotated (delete files older than 30 days).

```bash
# add to the same crontab to prune old backups:
20 2 * * * find /home/deploy/backups -name "ma_erp_*.sql.gz" -mtime +30 -delete
```

You're live.
