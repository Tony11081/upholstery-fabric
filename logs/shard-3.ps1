$env:ANTHROPIC_BASE_URL = "https://v3.codesome.cn"
$env:ANTHROPIC_AUTH_TOKEN = "sk-41f9890b39782fc8a00c92a0ba8d8839ccc259f5d1db1d19b83dd113d2fd7f1f"
$env:ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
$env:AI_BATCH_LIMIT = "0"
$env:AI_ITEM_DELAY_MS = "0"
$env:AI_CONCURRENCY = "5"
$env:AI_LOG_EVERY = "200"
$env:AI_MAX_RETRIES = "4"
$env:AI_TITLE_PREFIXES = "Luxury Bag #|Designer Bag|Unknown"
$env:AI_DESCRIPTION_FORCE = "true"
$env:AI_SHARD_COUNT = "4"
$env:AI_SHARD_INDEX = "3"

npx tsx scripts/categorize-products.ts
