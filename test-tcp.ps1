$client = New-Object System.Net.Sockets.TcpClient
try {
    Write-Host "Connecting to 23.94.38.181:5433..."
    $client.Connect('23.94.38.181', 5433)
    $stream = $client.GetStream()
    Write-Host "TCP connection successful!"

    # Try to read PostgreSQL startup message
    $buffer = New-Object byte[] 1024
    $stream.ReadTimeout = 3000
    try {
        $bytesRead = $stream.Read($buffer, 0, 1024)
        Write-Host "Received $bytesRead bytes from server"
        $hex = [System.BitConverter]::ToString($buffer[0..($bytesRead-1)])
        Write-Host "Data (hex): $hex"
    } catch {
        Write-Host "No data received (timeout or connection closed)"
    }
} catch {
    Write-Host "Connection failed: $($_.Exception.Message)"
} finally {
    if ($client) {
        $client.Close()
    }
}
