$urls = @(
    "http://localhost:3000/home",
    "http://localhost:3000/communities", 
    "http://localhost:3000/dashboard"
)

$markers = @(
    "Student path",
    "Your next best actions",
    "Workspace mode",
    "Image preview"
)

Write-Host "=== LOCALHOST:3000 PROBE ===" -ForegroundColor Cyan
Write-Host "Time: $(Get-Date)" -ForegroundColor Gray

foreach ($url in $urls) {
    Write-Host "`n--- $url ---" -ForegroundColor Yellow
    
    try {
        $response = Invoke-WebRequest -Uri $url -TimeoutSec 10 -ErrorAction Stop
        Write-Host "HTTP Status: $($response.StatusCode) - OK" -ForegroundColor Green
        Write-Host "Response Size: $($response.Content.Length) bytes"
        Write-Host "Searching for markers:"
        
        foreach ($marker in $markers) {
            if ($response.Content -like "*$marker*") {
                Write-Host "  ✓ FOUND: `'$marker`'" -ForegroundColor Green
            } else {
                Write-Host "  ✗ NOT FOUND: `'$marker`'" -ForegroundColor DarkGray
            }
        }
        
    } catch {
        $errMsg = $_.Exception.Message
        if ($errMsg -match "refused|Unable to connect") {
            Write-Host "HTTP Status: UNREACHABLE" -ForegroundColor Red
            Write-Host "Reason: localhost:3000 is not reachable (server may not be running)" -ForegroundColor Yellow
        } else {
            Write-Host "HTTP Status: ERROR" -ForegroundColor Red
            Write-Host "Error: $errMsg" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n=== END PROBE ===" -ForegroundColor Cyan
