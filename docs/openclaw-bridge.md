# OpenClaw Pull Bridge (No Inbound Ports)

Goal: let the cloud-hosted site use a local OpenClaw gateway **without** exposing any local ports.

How it works:

1. The website enqueues AI jobs into Postgres (`AiBridgeJob`).
2. Your local worker **pulls** jobs from the website over HTTPS (outbound only).
3. The worker calls your local OpenClaw gateway on `127.0.0.1`.
4. The worker posts results back to the website.

## 1) Website (Dokploy) env

Set:

```env
AI_PROVIDER=openclaw_bridge
OPENCLAW_BRIDGE_TOKEN=<strong-random-token>
OPENCLAW_MODEL=openclaw:main
```

Optional:

```env
OPENCLAW_BRIDGE_POLL_MS=600
OPENROUTER_TIMEOUT_MS=45000
```

## 2) Apply DB schema

This feature adds a Prisma model `AiBridgeJob`.

Run on the environment that can reach your Postgres:

```bash
npx prisma db push
npx prisma generate
```

## 3) Local OpenClaw (secure, loopback-only)

Recommended: bind to loopback only.

```bash
openclaw config set gateway.mode local
openclaw config set gateway.bind loopback
openclaw config set gateway.port 18789 --json
openclaw config set gateway.auth.mode token
openclaw config set gateway.auth.token "<your-token>"
openclaw config set gateway.http.endpoints.chatCompletions.enabled true --json

OPENCLAW_GATEWAY_TOKEN="<your-token>" openclaw gateway run --allow-unconfigured --force --bind loopback --port 18789
```

## 4) Run the local worker

From the `luxury-shop` repo root:

```bash
export OPENCLAW_BRIDGE_SITE_URL="https://luxuryootd.com"
export OPENCLAW_BRIDGE_TOKEN="<same-as-website>"
export OPENCLAW_LOCAL_BASE_URL="http://127.0.0.1:18789/v1"
export OPENCLAW_LOCAL_TOKEN="<your-openclaw-gateway-token>"

npx tsx scripts/openclaw-bridge-worker.ts
```

Notes:

- The worker is a long-running process. Use `pm2` or `launchd` if you need auto-restart.
- If the worker is not running, `AI_PROVIDER=openclaw_bridge` requests will timeout.

