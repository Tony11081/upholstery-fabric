param([string]$LogPath)
$ErrorActionPreference = "Stop"
Set-Location "e:\????\luxury-shop"
$envLine = Get-Content ".env" | Where-Object { $_ -match "^DATABASE_URL=" } | Select-Object -First 1
if (-not $envLine) { throw "DATABASE_URL missing in .env" }
$db = $envLine -replace "^DATABASE_URL=", ""
if (($db.StartsWith('"') -and $db.EndsWith('"')) -or ($db.StartsWith("'") -and $db.EndsWith("'"))) {
  $db = $db.Substring(1, $db.Length - 2)
}
if ($db -notmatch "connection_limit=") {
  $sep = "?"
  if ($db.Contains("?")) { $sep = "&" }
  $db = "$db${sep}connection_limit=1&pool_timeout=120"
}
$env:DATABASE_URL = $db
$env:AI_CATEGORY_MODE = "hierarchy"
$env:AI_CONCURRENCY = "2"
$env:AI_ITEM_DELAY_MS = "300"
$env:AI_LOG_EVERY = "10"
$env:AI_DESCRIPTION_FORCE = "true"

npx tsx scripts/categorize-products.ts *> $LogPath
