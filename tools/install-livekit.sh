#!/usr/bin/env bash
# install-livekit.sh
# One-shot installer for self-hosted LiveKit on a Linux VPS.
#
# Run AS ROOT on your server:
#   bash install-livekit.sh
#
# Prereqs:
#   - Ubuntu 22.04+ (or similar)
#   - nginx
#   - PM2 (npm install -g pm2)
#
# What this does:
#   1. Installs the LiveKit server binary
#   2. Generates an API key + secret
#   3. Writes /etc/livekit.yaml with sensible defaults
#   4. Adds an nginx vhost reverse-proxying to LiveKit over WSS at $LIVEKIT_DOMAIN
#      (or falls back to the bare VPS IP if unset)
#   5. Registers LiveKit under PM2 as 'livekit-server'
#   6. Prints the credentials to paste into your local ~/.war-room/.env
#
# Safe to re-run: skips already-installed steps. Does NOT regenerate keys.

set -euo pipefail

LIVEKIT_BIN=/usr/local/bin/livekit-server
LIVEKIT_CONFIG=/etc/livekit.yaml
LIVEKIT_PORT=7880
LIVEKIT_RTC_PORT_START=50000
LIVEKIT_RTC_PORT_END=50100
KEYS_FILE=/etc/livekit-keys.txt

# Tweak these if you want a real hostname behind nginx
DOMAIN="${LIVEKIT_DOMAIN:-}"           # e.g. "livekit.example.com" — leave empty to use raw IP+port
VPS_IP="$(curl -sS https://api.ipify.org || hostname -I | awk '{print $1}')"

# --- Step 1: install LiveKit binary ---
if [ ! -x "$LIVEKIT_BIN" ]; then
  echo "[1/6] Installing LiveKit server binary…"
  curl -sSL https://get.livekit.io | bash
else
  echo "[1/6] LiveKit binary already installed at $LIVEKIT_BIN ✓"
fi

# --- Step 2: generate API key + secret if missing ---
if [ ! -f "$KEYS_FILE" ]; then
  echo "[2/6] Generating API key + secret…"
  API_KEY="APIej$(openssl rand -hex 6)"
  API_SECRET="$(openssl rand -base64 32 | tr -d '=' | tr -d '\n')"
  cat > "$KEYS_FILE" <<EOF
LIVEKIT_API_KEY=$API_KEY
LIVEKIT_API_SECRET=$API_SECRET
EOF
  chmod 600 "$KEYS_FILE"
else
  echo "[2/6] Keys already exist at $KEYS_FILE ✓"
  # shellcheck disable=SC1090
  source "$KEYS_FILE"
  API_KEY="$LIVEKIT_API_KEY"
  API_SECRET="$LIVEKIT_API_SECRET"
fi

# --- Step 3: write LiveKit config ---
echo "[3/6] Writing $LIVEKIT_CONFIG…"
cat > "$LIVEKIT_CONFIG" <<EOF
port: $LIVEKIT_PORT
bind_addresses:
  - "0.0.0.0"
rtc:
  port_range_start: $LIVEKIT_RTC_PORT_START
  port_range_end: $LIVEKIT_RTC_PORT_END
  use_external_ip: true
  tcp_port: 7881
keys:
  $API_KEY: $API_SECRET
room:
  auto_create: true
  max_participants: 20
  empty_timeout: 600
logging:
  level: info
EOF

# --- Step 4: open firewall ports ---
echo "[4/6] Opening firewall ports (UFW)…"
if command -v ufw >/dev/null 2>&1; then
  ufw allow $LIVEKIT_PORT/tcp || true
  ufw allow 7881/tcp || true
  ufw allow $LIVEKIT_RTC_PORT_START:$LIVEKIT_RTC_PORT_END/udp || true
fi

# --- Step 5: nginx vhost ---
if [ -n "$DOMAIN" ]; then
  echo "[5/6] Writing nginx vhost for $DOMAIN…"
  cat > /etc/nginx/sites-available/livekit <<NGINX
server {
  listen 80;
  server_name $DOMAIN;
  location / {
    proxy_pass http://127.0.0.1:$LIVEKIT_PORT;
    proxy_http_version 1.1;
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_read_timeout 86400;
  }
}
NGINX
  ln -sf /etc/nginx/sites-available/livekit /etc/nginx/sites-enabled/livekit
  nginx -t && systemctl reload nginx
  echo "    → After this, run: certbot --nginx -d $DOMAIN"
  echo "    → Your dashboards then use: wss://$DOMAIN"
else
  echo "[5/6] No DOMAIN set — clients will use ws://$VPS_IP:$LIVEKIT_PORT (no TLS)."
  echo "    For TLS, rerun with:  LIVEKIT_DOMAIN=livekit.your-domain.com bash install-livekit.sh"
fi

# --- Step 6: PM2 boot ---
echo "[6/6] Registering with PM2…"
pm2 delete livekit-server 2>/dev/null || true
pm2 start "$LIVEKIT_BIN" --name livekit-server -- --config "$LIVEKIT_CONFIG"
pm2 save

# --- Output: credentials to paste into .env ---
echo
echo "=========================================="
echo "  DONE. Add these to ~/.war-room/.env on each teammate's PC:"
echo "=========================================="
if [ -n "$DOMAIN" ]; then
  echo "LIVEKIT_URL=wss://$DOMAIN"
else
  echo "LIVEKIT_URL=ws://$VPS_IP:$LIVEKIT_PORT"
fi
echo "LIVEKIT_API_KEY=$API_KEY"
echo "LIVEKIT_API_SECRET=$API_SECRET"
echo "=========================================="
