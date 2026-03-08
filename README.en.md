# NEWUOOTD Luxury Commerce (Next.js + Prisma + Hosted Payments)

## Tech stack
- Next.js App Router (TypeScript, Tailwind v4)
- Prisma + PostgreSQL
- Zustand for client state (bag + checkout)
- Hosted payment links (PayPal invoices supported)
- Direct checkout flow with invoice/pay-link mode

## Environment
Copy `.env.example` to `.env` and fill:
- `DATABASE_URL`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `NEXT_PUBLIC_SITE_URL` (e.g., `https://yourdomain.com`)
- Analytics (optional): `NEXT_PUBLIC_ANALYTICS_PROVIDER` (`none` | `ga4` | `posthog`), `NEXT_PUBLIC_GA_ID`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`
- Stripe keys (optional, payments are not using Stripe): `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `PAYMENT_MODE` (`invoice` default; Stripe mode is not used for payments)
- `NEXT_PUBLIC_PAYMENT_MODE` (legacy client toggle; Stripe not used for payments)
- Inflyway extension IDs: `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID` (prod), `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID_TEST` (test channel)
- Optional: `ADMIN_PAYMENT_LINK_TOKEN` to allow setting hosted payment links via API
- Optional: `ADMIN_PASSWORD` to enable password sign-in for admins
- SMTP (for request and payment-link emails): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SUPPORT_EMAIL`
- Concierge (client links): `NEXT_PUBLIC_CONCIERGE_WHATSAPP`, `NEXT_PUBLIC_CONCIERGE_WECHAT`, `NEXT_PUBLIC_CONCIERGE_PHONE`, `NEXT_PUBLIC_CONCIERGE_EMAIL`, `NEXT_PUBLIC_SUPPORT_EMAIL`
- Automation webhooks (SMS/WhatsApp): `SMS_WEBHOOK_URL`, `WHATSAPP_WEBHOOK_URL`
- Admin access allowlist: `ADMIN_EMAILS` (comma-separated)
- Inventory alerts: `NEXT_PUBLIC_LOW_STOCK_THRESHOLD` (default 5)
- Optional: Google/Email auth, S3 storage, PayPal keys
- AI import (OpenRouter): `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`, `AI_IMPORT_ENABLED`
  - Preview signing + limits: `AI_PREVIEW_SECRET`, `AI_PREVIEW_TTL_SECONDS`, `AI_RATE_LIMIT_PER_MINUTE`, `AI_CONCURRENCY_LIMIT`
  - Cost estimate + validation: `AI_COST_PER_1K_TOKENS_USD`, `AI_EST_OUTPUT_TOKENS`, `AI_IMAGE_TOKEN_BONUS`, `AI_IMAGE_VALIDATE_TIMEOUT_MS`, `IMPORT_VALIDATE_IMAGES`
  - Categorization mode: `AI_CATEGORY_MODE` (`flat` product categories by default; set `brand` for brand -> category hierarchy)

## Setup and scripts
```bash
npm install
# Stop any running dev server before generating Prisma client
npx prisma generate
npx prisma db push           # or prisma migrate deploy in production
npm run db:seed              # demo data
npm run dev
```
Build/start and checks:
```bash
npm run lint
npm run typecheck
npm run build
npm run start
```

## Deployment notes
- Prisma/Next type fixes: normalize Prisma Decimal/JSON/enum usage in API routes and UI to keep `npm run build` clean.
- Product quality scoring now returns `{ score, notes }`, aligning admin/import/seed usage.
- Editorial index is forced dynamic to avoid build-time DB access (prevents CI/Docker build failure when DB is not reachable).
- Mock data/test checkout payloads align with current store types; Chrome extension payment step has typed responses.

## Stripe (optional, currently unused)
- Note: Stripe checkout is disabled for payments; keep this section only if re-enabling.
- Checkout session uses DB prices only; metadata carries the order number.
- Webhook: `POST /api/stripe/webhook` (raw body, signature verified, idempotent on `stripeSessionId`).
- Success page resolves the real order by `session_id` or order number/email. Mocks are disabled in production.
- In production, missing Stripe keys/DB returns clear errors instead of mocks.

### Test the webhook locally
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
# In another shell, run the app and create a checkout through the UI
# or trigger a test event:
stripe trigger checkout.session.completed
```

## Database
- Schema: `prisma/schema.prisma` (includes `stripeSessionId` on orders).
- Use `prisma db push` for local dev; use migrations for deployment.
- Seed script: `npm run db:seed`.

## Admin console
- Visit `/admin` after signing in with an email listed in `ADMIN_EMAILS`.
- Admin password sign-in is enabled when `ADMIN_PASSWORD` + `ADMIN_EMAILS` are set.
- Customers: `/admin/customers` (profiles, tags/segments, export).
- Categories: `/admin/categories`.
- Products: `/admin/products` (bulk actions + CSV/Excel import + AI assist).
- Discounts: `/admin/discounts` (global/category/product).
- Coupons: `/admin/coupons`.
- Orders: `/admin/orders` (status updates + CSV export).
- Aftercare: `/admin/aftercare` (refund/return cases).
- Concierge: `/admin/concierge` (consultation requests).
- Requests: `/admin/requests` (send payment links).
- Referrals: `/admin/referrals` (codes + rewards).
- Reviews: `/admin/reviews` (approve + reward coupon).
- VIP: `/admin/vip` (tiers + points).
- Automations: `/admin/automations` (multi-channel triggers).
- Experiments: `/admin/experiments` (A/B tests).
- Content: `/admin/content` (editorial + drops).
- Subscriptions: `/admin/subscriptions` (back-in-stock/price-drop/new-arrival).
- Analytics: `/admin/analytics` (funnel + RFM + UTM).

CSV/Excel import expects headers like: `title`, `slug`, `price`, `currency`, `description`, `category_slug`, `category_name`, `tags`, `image_urls`, `inventory`, `is_new`, `is_best_seller`, `is_active`.
Use `|` or `;` as the separator inside `tags` and `image_urls`.
Download templates at `/templates/products-template.csv` and `/templates/products-template.xlsx`.

## AI import (OpenRouter)
- Enable AI assist by setting `OPENROUTER_API_KEY` and `AI_IMPORT_ENABLED=true`.
- Default model is `anthropic/claude-sonnet-4.5` (override with `OPENROUTER_MODEL`).
- In `/admin/products`, toggle "AI assist" before uploading CSV/Excel to translate Chinese, generate titles from images, and categorize.
- Use "Preview AI" to review the normalized rows, then enable "Use preview results" to import without re-running AI.
- Preview results are signed with `AI_PREVIEW_SECRET` and expire after `AI_PREVIEW_TTL_SECONDS`.

Uploads are saved to `/public/uploads` by default. To use object storage, set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Optional: `S3_ENDPOINT` (R2/MinIO), `S3_PUBLIC_URL` (CDN), `S3_FORCE_PATH_STYLE=true` (R2).

## Inventory alerts
- PDP shows "Notify me" when inventory is 0.
- When inventory transitions from 0 to positive, pending subscribers receive a back-in-stock email.
- Admin product table highlights low-stock inventory using `NEXT_PUBLIC_LOW_STOCK_THRESHOLD`.

## Analytics
- Set `NEXT_PUBLIC_ANALYTICS_PROVIDER=ga4` with `NEXT_PUBLIC_GA_ID` or `NEXT_PUBLIC_ANALYTICS_PROVIDER=posthog` with `NEXT_PUBLIC_POSTHOG_KEY`.
- Page views + key events are tracked (search, PDP view, add to bag, checkout started).

## Dokploy 閮ㄧ讲

### 鏈嶅姟鍣ㄤ俊鎭?
- 鍩熷悕: `whatsapp-whatsapp-9xkkac-c0aeed-23-94-38-181.traefik.me`
- 鏈嶅姟鍣?IP: `23.94.38.181`
- 鏁版嵁搴撶鍙? `5433`
- 鏁版嵁搴? PostgreSQL

### 閮ㄧ讲姝ラ
1. 鎺ㄩ€佷唬鐮佸埌 GitHub: `git push`
2. 鍦?Dokploy 鎺у埗鍙拌Е鍙戦儴缃?
3. 绛夊緟 Nixpacks 鏋勫缓瀹屾垚

### 閲嶈鏇存柊璁板綍
- 2026-01: Refined customer-facing copy to strengthen trust messaging across checkout, delivery, support, and policies.
- 2026-01: Reduced homepage filter density by showing top categories/brands with a More affordance.
- 2026-01: Made homepage category/brand chips horizontally scrollable to avoid filters filling the viewport.
- 2026-01: Chrome extension now sets product quantity to match the order amount when creating orders.
- 2026-01: Quantity auto-fill enhanced to work with stepper controls (plus/minus) and non-number inputs.
- 2026-01: Chrome extension waits for the product list to load before selecting items in Inflyway order creation.
- 2026-01: Inflyway product picker now sets quantity to match the order amount before confirming.
- 2026-01: Inflyway order sync now confirms the item row is added before proceeding to totals.
- 2026-01: Awaiting payment now decodes QR to auto-open hosted checkout when link is missing.
- 2026-01: Added a minimalist tech animation on the awaiting payment page to show activity.
- 2026-01: Added an always-on WhatsApp concierge fallback on awaiting-payment with prefilled product links.
- 2026-01: Awaiting-payment WhatsApp CTA now localizes its label based on browser language.
- 2026-01: Moved awaiting-payment WhatsApp CTA higher in the card for visibility on short viewports.
- 2026-01: Szwego importer now captures per-product descriptions and source links; import API stores source link in quality notes.
- 2026-01: Import batch now skips products without a valid price to avoid default pricing.
- 2026-01: Chrome extension now captures payment links/QRs from network responses and retries write-back with a background sync queue; admin sync UI shows retry status and a resync action.
- 2026-01: Payment link sync accepts `inflywayOrderId`, and the admin sync UI can pass `ADMIN_PAYMENT_LINK_TOKEN` to the extension for cookie-free background updates.
- 2026-01: Admin order sync now defaults to auto mode and persists the toggle in local storage.
- 2026-01: Pending-payment admin list now returns up to 100 orders per fetch.
- 2026-01: Added a dedicated payment test channel (`/checkout/payment-test`) using `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID_TEST` so production stays on `NEXT_PUBLIC_INFLYWAY_EXTENSION_ID` without code edits.
- 2026-01: Added a test order seeder on `/checkout/payment-test` to auto-fill bag, address, and shipping for plugin debugging.
- 2026-01: Test extension now forces the phone prefix dropdown open, always includes the dial code from the phone when matching, can fall back to Vue option selection, and locates the prefix input by scanning the phone field group/label.
- 2026-01: Test extension avoids touching currency selects, expands prefix triggers beyond `.el-select` inputs, prioritizes phone dial when country mismatches, adds ISO-code candidates for prefix matching, and adds a robust plus-button fallback when selecting products.
- 2026-01: Test extension now prefers the editable phone input, targets the prefix selector in the phone row, forces country reselect when mismatched, and fills address fields with label fallbacks.
- 2026-01: Test extension now selects products by row (checkbox/plus fallbacks) and skips country selection after prefix is chosen.
- 2026-01: Test extension only fills state/province when provided and pastes it directly without opening the dropdown.
- 2026-01: Added checkout test mode address modal (English shipping fields) gated by `NEXT_PUBLIC_CHECKOUT_TEST_MODE`. The modal UI is now additionally hidden unless `NEXT_PUBLIC_CHECKOUT_TEST_MODAL=1`.
- 2026-01: 稳定测试版1（回撤标记）：当前测试插件逻辑版本，包含商品行选择、前缀准确匹配、地址标签兜底、前缀后跳过国家选择、州/省仅有值时直填。
- 2026-01: Normalized product categories/tags into canonical product types and improved brand tag filtering.
- 2026-01: Added duplicate-title disambiguation script and surfaced PDP detail highlights.
- 2026-01: 浣跨敤 Szwego 涓枃鏍囬/鎻忚堪杞崲涓鸿嫳鏂囨爣棰樹笌鎻忚堪鐨勮鍒欏寲宸ュ叿锛坄scripts/szwego-normalize-titles.ts`锛岄渶瑕?`SZW_COOKIE`锛夈€?
- 2026-01: 鎵归噺淇鍗犱綅鍟嗗搧鏍囬锛圖esigner Bag -> Luxury Bag #CODE锛夛紝鑴氭湰 `scripts/fix-placeholder-titles.ts`銆?
- 2026-01: AI image input defaults to URL (`AI_IMAGE_MODE=url`) with optional `AI_IMAGE_DETAIL` to cut token usage; base64 still supported.
- 2026-01: AI璇嗗埆鑴氭湰鏀逛负璇诲彇鐜鍙橀噺锛堝惈鏈湴涓浆锛夈€佹敮鎸侀檺娴侀噸璇曚笌灏忔壒娆″鐞嗭紝骞舵寜鈥滃搧鐗?绯诲垪/鍨嬪彿+鍝佺被鈥濈敓鎴愭爣棰樸€佸搧鐗屸啋鍝佺被鍒嗙被銆?- 2026-01: Categorize script supports concurrency (`AI_CONCURRENCY`), log throttling (`AI_LOG_EVERY`), and auto descriptions (`AI_DESCRIPTION_FORCE` to overwrite).
- 2026-01: AI categorize script supports Anthropic proxy via `ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, and `ANTHROPIC_MODEL`; use `AI_TITLE_PREFIXES` to target placeholder titles.
- 2026-01: 绛夊緟浠樻椤靛鍔犺嚜鍔ㄨ烦杞彁閱掍笌鏋佺畝鍔ㄧ敾锛屽苟璇存槑璺宠浆鍚庡～鍐欐敹璐у湴鍧€涓庝粯娆俱€佸彲杩斿洖缁х画璐墿銆?
- 2026-01: Improve payment flow fallback (invoice request fallback only) and show PayPal invoice links on awaiting-payment.
- 2026-01: Optimize product list responses (lighter selects, discount cache, and conservative prefetch/priority images).
- 2026-01: Performance tune-up: limit list images to cover only, cache list/brand APIs briefly, lazy-load filter modal, and reduce refetches.
- 2026-01: 娣诲姞 Szwego 浜у搧瀵煎叆鎻掍欢 (`szwego-importer/`)
- 2026-01: 娣诲姞浜у搧瀵煎叆 API (`/api/import-product`)
- 2026-01: 淇 Next.js 16 async params 绫诲瀷闂
- 2026-01: 娣诲姞 `quality.ts` 浜у搧璐ㄩ噺璇勫垎妯″潡

### Szwego 瀵煎叆鎻掍欢
Chrome 鎵╁睍鐢ㄤ簬浠?Szwego (寰喘鐩稿唽) 鎵归噺瀵煎叆浜у搧锛?
- 瀹夎: Chrome -> 鎵╁睍绋嬪簭 -> 鍔犺浇宸茶В鍘嬬殑鎵╁睍绋嬪簭 -> 閫夋嫨 `szwego-importer` 鏂囦欢澶?
- 浣跨敤: 鍦?Szwego 浜у搧鍒楄〃椤甸潰鍕鹃€変骇鍝侊紝鐐瑰嚮"瀵煎叆閫変腑浜у搧"
- 浠锋牸瑙勫垯: 浜烘皯甯?脳 1.2 = 缇庡厓锛屾渶楂?$450锛屾渶浣?$95

### Inflyway 璁㈠崟鍚屾
鑷姩灏嗗鎴疯鍗曞悓姝ュ埌 inflyway.com 鍒涘缓鏀粯锛?
1. 瀹夎 Chrome 鎻掍欢: 鍔犺浇 `chrome-extension` 鏂囦欢澶?
2. 鎵撳紑 inflyway.com 骞朵繚鎸佺櫥褰?3. 璁块棶 `/admin/order-sync` 椤甸潰
4. 杈撳叆鎻掍欢 ID锛屽紑鍚嚜鍔ㄥ鐞嗘ā寮?5. 瀹㈡埛涓嬪崟鍚庤嚜鍔ㄥ垱寤?inflyway 鏀粯璁㈠崟
6. Reload the extension after updating permissions (luxuryootd + flylinking hosts).
7. Optional: set `ADMIN_PAYMENT_LINK_TOKEN` and paste it into the admin sync page to allow background sync without admin cookies.

## Health endpoint
- `GET /api/health` returns version + database connectivity.

## QA checklist
1) Home -> Search -> PDP -> Add to bag -> Bag
2) Checkout: Address -> Shipping -> Payment (invoice/pay link) -> Success
3) Track order with the order number/email just used

## Tests
- `npm run lint`
- `npm run typecheck`
- `npx playwright install` (one-time)
- `npx playwright test`





