param(
    [int]$Port = 5000
)

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "     CtrlC-Coin Single Instance Launcher     " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Clean up any existing process listening on this specific port
Write-Host "[*] Target Port: $Port" -ForegroundColor Yellow
$occupied = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($occupied) {
    foreach ($procId in $occupied.OwningProcess) {
        if ($procId -gt 0) {
            taskkill /F /PID $procId 2>$null | Out-Null
        }
    }
}

# 2. Start Python Node on the chosen port in background
Write-Host "[*] Starting Python Blockchain Node on Port $Port..." -ForegroundColor Yellow
$nodeProcess = Start-Process -FilePath "python" -ArgumentList "node.py $Port" -WindowStyle Hidden -PassThru

# 3. Ensure Vite UI server is running on port 5173
$viteActive = $false
try {
    $resp = Invoke-WebRequest -Uri "http://localhost:5173" -UseBasicParsing -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($resp.StatusCode -eq 200) { $viteActive = $true }
} catch {}

if (-not $viteActive) {
    Write-Host "[*] Booting UI Engine..." -ForegroundColor DarkGray
    Start-Process -FilePath "npx.cmd" -ArgumentList "vite", "--port", "5173" -WorkingDirectory "$PSScriptRoot\frontend" -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

# 4. Launch Electron Desktop Window for this specific port
Write-Host "[*] Launching Desktop Window for Port $Port..." -ForegroundColor Green
Push-Location "$PSScriptRoot\frontend"
try {
    npx.cmd electron . --port=$Port
} finally {
    Pop-Location
}

# 5. When the desktop window is closed, cleanly terminate the background node
Write-Host "[*] Stopping Node on Port $Port..." -ForegroundColor DarkGray
if ($nodeProcess -and -not $nodeProcess.HasExited) {
    Stop-Process -Id $nodeProcess.Id -Force -ErrorAction SilentlyContinue
}
Write-Host "[+] Session ended cleanly." -ForegroundColor Green
