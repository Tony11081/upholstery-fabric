# OpenClaw on Dokploy

This folder contains a production-ready Dokploy compose file for running OpenClaw Gateway with an OpenAI-compatible endpoint (`/v1/chat/completions`).

## 1. Deploy OpenClaw app in Dokploy

1. Create a new **Docker Compose** application in Dokploy (suggest name: `openclaw-gateway`).
2. Paste `deploy/openclaw/docker-compose.dokploy.yml` into Dokploy compose editor.
3. Add environment variable:

```env
OPENCLAW_GATEWAY_TOKEN=<generate_a_long_random_token>
```

4. Expose domain (example): `ai.luxuryootd.com` -> container port `18789`.
5. Deploy.

## 2. Verify OpenClaw endpoint

Run from your terminal:

```bash
curl -sS https://ai.luxuryootd.com/v1/chat/completions \
  -H "Authorization: Bearer <OPENCLAW_GATEWAY_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openclaw:main",
    "messages": [{"role":"user","content":"ping"}]
  }'
```

If the endpoint is reachable, you should receive a JSON response from OpenClaw.

## 3. Connect your website (Dokploy env for `luxury-shop`)

Set these in your website service:

```env
AI_PROVIDER=openclaw
OPENCLAW_BASE_URL=https://ai.luxuryootd.com/v1
OPENCLAW_API_KEY=<same_OPENCLAW_GATEWAY_TOKEN>
OPENCLAW_MODEL=openclaw:main
AI_IMAGE_MODEL=openclaw:main
```

Then redeploy the website service.

## Notes

- `OPENCLAW_GATEWAY_TOKEN` is required by the gateway and also used by website as bearer token.
- OpenClaw state is persisted in named volume `openclaw_data`.
- The compose command auto-enables:
  - `gateway.http.enabled`
  - `gateway.http.endpoints.chatCompletions.enabled`
  - `gateway.http.endpoints.chatCompletions.requireAuth`

## References

- OpenClaw HTTP endpoint docs: https://docs.openclaw.ai/guides/gateway-http-endpoint
- OpenClaw official repository: https://github.com/openclaw/openclaw
