#!/usr/bin/env sh
set -eu

SERVER_HOST=${SERVER_HOST:?SERVER_HOST is required}
SERVER_USER=${SERVER_USER:-root}
SERVER_PORT=${SERVER_PORT:-22}
SERVER_PASSWORD=${SERVER_PASSWORD:-}

DEPLOY_PATH=${DEPLOY_PATH:-/opt/azbuka-vkusa}
DOMAIN=${DOMAIN:-v3180765.hosted-by-vdsina.ru}
IMAGE_REGISTRY=${IMAGE_REGISTRY:-ghcr.io/daniil11ru/azbuka-vkusa}
IMAGE_TAG=${IMAGE_TAG:-latest}
POSTGRES_DB=${POSTGRES_DB:-pricing}
POSTGRES_USER=${POSTGRES_USER:-pricing}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-}
JWT_SECRET=${JWT_SECRET:-}
GHCR_USERNAME=${GHCR_USERNAME:-}
GHCR_TOKEN=${GHCR_TOKEN:-}

if [ ! -f docker-compose.prod.yml ] || [ ! -f Caddyfile ]; then
  printf '%s\n' 'Run this script from the repository root.' >&2
  exit 1
fi

if [ -n "$SERVER_PASSWORD" ] && ! command -v sshpass >/dev/null 2>&1; then
  printf '%s\n' 'sshpass is required when SERVER_PASSWORD is set.' >&2
  exit 1
fi

if [ -n "$GHCR_TOKEN" ] && [ -z "$GHCR_USERNAME" ]; then
  printf '%s\n' 'GHCR_USERNAME is required when GHCR_TOKEN is set.' >&2
  exit 1
fi

ssh_exec() {
  if [ -n "$SERVER_PASSWORD" ]; then
    SSHPASS=$SERVER_PASSWORD sshpass -e ssh \
      -p "$SERVER_PORT" \
      -o StrictHostKeyChecking=accept-new \
      "$SERVER_USER@$SERVER_HOST" "$@"
  else
    ssh \
      -p "$SERVER_PORT" \
      -o StrictHostKeyChecking=accept-new \
      "$SERVER_USER@$SERVER_HOST" "$@"
  fi
}

scp_to_server() {
  if [ -n "$SERVER_PASSWORD" ]; then
    SSHPASS=$SERVER_PASSWORD sshpass -e scp \
      -P "$SERVER_PORT" \
      -o StrictHostKeyChecking=accept-new \
      "$@" "$SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/"
  else
    scp \
      -P "$SERVER_PORT" \
      -o StrictHostKeyChecking=accept-new \
      "$@" "$SERVER_USER@$SERVER_HOST:$DEPLOY_PATH/"
  fi
}

quote_env() {
  printf "%s" "$1" | sed "s/'/'\\''/g"
}

tmp_env=$(mktemp)
trap 'rm -f "$tmp_env"' EXIT
chmod 600 "$tmp_env"

{
  printf "IMAGE_REGISTRY='%s'\n" "$(quote_env "$IMAGE_REGISTRY")"
  printf "IMAGE_TAG='%s'\n" "$(quote_env "$IMAGE_TAG")"
  printf "DOMAIN='%s'\n" "$(quote_env "$DOMAIN")"
  printf "POSTGRES_DB='%s'\n" "$(quote_env "$POSTGRES_DB")"
  printf "POSTGRES_USER='%s'\n" "$(quote_env "$POSTGRES_USER")"
  printf "POSTGRES_PASSWORD_INPUT='%s'\n" "$(quote_env "$POSTGRES_PASSWORD")"
  printf "JWT_SECRET_INPUT='%s'\n" "$(quote_env "$JWT_SECRET")"
} > "$tmp_env"

printf '%s\n' "Installing Docker on $SERVER_HOST..."
ssh_exec 'bash -s' <<'REMOTE'
set -eu
export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release openssl
  install -m 0755 -d /etc/apt/keyrings

  . /etc/os-release
  case "$ID" in
    ubuntu|debian) repo_os="$ID" ;;
    *) printf 'Unsupported OS: %s\n' "$ID" >&2; exit 1 ;;
  esac

  keyring="/etc/apt/keyrings/docker.gpg"
  if [ ! -f "$keyring" ]; then
    curl -fsSL "https://download.docker.com/linux/${repo_os}/gpg" | gpg --dearmor -o "$keyring"
  fi
  chmod a+r "$keyring"

  codename="${VERSION_CODENAME:-}"
  repo_url="https://download.docker.com/linux/${repo_os}"
  if [ -z "$codename" ] || ! curl -fsI "${repo_url}/dists/${codename}/Release" >/dev/null; then
    if [ "$repo_os" = ubuntu ]; then
      codename=noble
    else
      codename=bookworm
    fi
  fi

  printf 'deb [arch=%s signed-by=%s] %s %s stable\n' \
    "$(dpkg --print-architecture)" "$keyring" "$repo_url" "$codename" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker
REMOTE

printf '%s\n' "Uploading deployment files to $DEPLOY_PATH..."
ssh_exec "install -d -m 755 '$DEPLOY_PATH'"
scp_to_server docker-compose.prod.yml Caddyfile "$tmp_env"
ssh_exec "mv '$DEPLOY_PATH/$(basename "$tmp_env")' '$DEPLOY_PATH/.bootstrap.env' && chmod 600 '$DEPLOY_PATH/.bootstrap.env'"

printf '%s\n' 'Creating server .env...'
ssh_exec 'bash -s' <<REMOTE
set -eu
cd '$DEPLOY_PATH'
. ./.bootstrap.env

get_or_create_secret() {
  name="\$1"
  provided="\$2"

  if [ -n "\$provided" ]; then
    printf '%s' "\$provided"
    return
  fi

  if [ -f .env ]; then
    existing=\$(grep "^\${name}=" .env | tail -n 1 | cut -d= -f2- || true)
    if [ -n "\$existing" ]; then
      printf '%s' "\$existing"
      return
    fi
  fi

  openssl rand -hex 32
}

POSTGRES_PASSWORD_VALUE=\$(get_or_create_secret POSTGRES_PASSWORD "\${POSTGRES_PASSWORD_INPUT:-}")
JWT_SECRET_VALUE=\$(get_or_create_secret JWT_SECRET "\${JWT_SECRET_INPUT:-}")

{
  printf 'IMAGE_REGISTRY=%s\n' "\$IMAGE_REGISTRY"
  printf 'IMAGE_TAG=%s\n' "\$IMAGE_TAG"
  printf 'DOMAIN=%s\n' "\$DOMAIN"
  printf 'POSTGRES_DB=%s\n' "\$POSTGRES_DB"
  printf 'POSTGRES_USER=%s\n' "\$POSTGRES_USER"
  printf 'POSTGRES_PASSWORD=%s\n' "\$POSTGRES_PASSWORD_VALUE"
  printf 'JWT_SECRET=%s\n' "\$JWT_SECRET_VALUE"
} > .env.tmp
mv .env.tmp .env
chmod 600 .env
rm -f .bootstrap.env
REMOTE

if [ -n "$GHCR_TOKEN" ]; then
  printf '%s\n' 'Logging in to GHCR on the server...'
  printf '%s' "$GHCR_TOKEN" | ssh_exec "docker login ghcr.io -u '$GHCR_USERNAME' --password-stdin"
fi

printf '%s\n' 'Pulling images and starting services...'
ssh_exec "cd '$DEPLOY_PATH' && docker compose --env-file .env -f docker-compose.prod.yml config --quiet && docker compose --env-file .env -f docker-compose.prod.yml pull && docker compose --env-file .env -f docker-compose.prod.yml up -d --remove-orphans && docker image prune -f"

printf '%s\n' "Done. Open https://$DOMAIN"
