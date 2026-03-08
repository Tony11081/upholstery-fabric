$env:PGPASSWORD = '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'
$pgDump = 'C:\Program Files\PostgreSQL\17\bin\pg_dump.exe'
$dumpFile = 'C:\temp\backup-remote.dump'

for ($i = 1; $i -le 10; $i++) {
    Write-Host "Attempt $i of 10..."
    & $pgDump -h 23.94.38.181 -p 5433 -U luxury-shop -d luxury-shop -F c -f $dumpFile 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "SUCCESS: Database exported!"
        exit 0
    }
    Write-Host "Failed, waiting 5 seconds..."
    Start-Sleep -Seconds 5
}

Write-Host "All attempts failed"
exit 1
