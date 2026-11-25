#!/usr/bin/env bash
# Provision an Ubuntu host to run SDG 12 Energi (Axum + PostgreSQL, serves the frontend).
# Idempotent: rerun to deploy the latest origin/main.
#
#   sudo REPO=https://github.com/Chariszi/SDGS-12-Save-Energi.git ./scripts/provision-ubuntu.sh
#
# After it finishes the app is on http://<lan-ip>:8080. Exposure options: see the
# printout at the end.
set -euo pipefail

[[ $EUID -eq 0 ]] || exec sudo --preserve-env=REPO,BRANCH,PORT "$0" "$@"

REPO=${REPO:-https://github.com/Chariszi/SDGS-12-Save-Energi.git}
BRANCH=${BRANCH:-main}
PORT=${PORT:-8080}
APP_USER=sdg12
APP_DIR=/opt/sdg12/app
ENV_FILE=$APP_DIR/backend/.env
DB_NAME=sdg12_energi
DB_ROLE=sdg12_app

say() { printf '\n== %s\n' "$*"; }

say "Installing packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq postgresql curl ca-certificates git build-essential >/dev/null
systemctl enable --now postgresql

say "Creating service user $APP_USER"
id -u "$APP_USER" >/dev/null 2>&1 || \
    useradd --system --create-home --home-dir /opt/sdg12 --shell /bin/bash "$APP_USER"

say "Preparing database $DB_NAME"
# Reuse the existing password on rerun so the app keeps working.
if [[ -f $ENV_FILE ]]; then
    DB_PASS=$(sed -n 's|^DATABASE_URL=postgres://[^:]*:\([^@]*\)@.*|\1|p' "$ENV_FILE")
fi
DB_PASS=${DB_PASS:-$(openssl rand -hex 16)}
db_psql() { sudo -u postgres psql -v ON_ERROR_STOP=1 -qAt "$@"; }
if [[ $(db_psql -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_ROLE'") != 1 ]]; then
    db_psql -c "CREATE ROLE $DB_ROLE LOGIN PASSWORD '$DB_PASS'"
fi
if [[ $(db_psql -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'") != 1 ]]; then
    db_psql -c "CREATE DATABASE $DB_NAME OWNER $DB_ROLE"
fi

say "Installing Rust toolchain for $APP_USER"
sudo -u "$APP_USER" bash -lc '
    command -v cargo >/dev/null || curl --proto "=https" --tlsv1.2 -sSf https://sh.rustup.rs \
        | sh -s -- -y --profile minimal --no-modify-path
' || true

say "Fetching $REPO ($BRANCH)"
if [[ -d $APP_DIR/.git ]]; then
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth=1 origin "$BRANCH"
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
    install -d -o "$APP_USER" -g "$APP_USER" /opt/sdg12
    sudo -u "$APP_USER" git clone --depth=1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi

say "Writing $ENV_FILE"
cat >"$ENV_FILE" <<EOF
DATABASE_URL=postgres://$DB_ROLE:$DB_PASS@127.0.0.1:5432/$DB_NAME
BIND_ADDR=0.0.0.0:$PORT
EOF
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

say "Building release binary"
sudo -u "$APP_USER" bash -lc "cd '$APP_DIR/backend' && \$HOME/.cargo/bin/cargo build --release"

say "Installing sdg12.service"
cat >/etc/systemd/system/sdg12.service <<'EOF'
[Unit]
Description=SDG 12 Energi
After=network-online.target postgresql.service
Wants=network-online.target

[Service]
Type=simple
User=sdg12
WorkingDirectory=/opt/sdg12/app/backend
EnvironmentFile=/opt/sdg12/app/backend/.env
ExecStart=/opt/sdg12/app/backend/target/release/sdg12-backend
Restart=always
RestartSec=2
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable sdg12 >/dev/null
systemctl restart sdg12

say "Opening port $PORT to the LAN only"
if command -v ufw >/dev/null && ufw status | grep -q '^Status: active'; then
    for net in 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16; do
        ufw allow from "$net" to any port "$PORT" proto tcp >/dev/null
    done
fi

say "Health check"
for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
        LAN_IP=$(hostname -I | awk '{print $1}')
        curl -sS "http://127.0.0.1:$PORT/api/health"; echo
        printf '\nRunning: http://%s:%s\n' "$LAN_IP" "$PORT"
        exit 0
    fi
    sleep 1
done

echo "App did not become healthy. Logs:" >&2
journalctl -u sdg12 -n 40 --no-pager >&2
exit 1
