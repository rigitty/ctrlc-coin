Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "   Starting CtrlC-Coin 2-Node Network Demo   " -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# 1. Start Node 1 (Port 5000) in a new window
Write-Host "[*] Launching Node 1 on port 5000..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'CtrlC-Coin NODE 1 (Port 5000)' -ForegroundColor Cyan; python node.py 5000"

# 2. Start Node 2 (Port 5001) in a new window
Write-Host "[*] Launching Node 2 on port 5001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'CtrlC-Coin NODE 2 (Port 5001)' -ForegroundColor Green; python node.py 5001"

# 3. Wait 2 seconds for servers to boot
Start-Sleep -Seconds 2

# 4. Cross-register peers
Write-Host "[*] Registering peers between Node 1 and Node 2..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "http://localhost:5000/nodes/register" -Method Post -ContentType "application/json" -Body '{"nodes": ["http://localhost:5001"]}' | Out-Null
    Invoke-RestMethod -Uri "http://localhost:5001/nodes/register" -Method Post -ContentType "application/json" -Body '{"nodes": ["http://localhost:5000"]}' | Out-Null
    Write-Host "[+] Nodes successfully peered!" -ForegroundColor Green
} catch {
    Write-Host "[-] Could not auto-peer nodes. You can do it manually." -ForegroundColor Red
}

# 5. Start Vite Dev Server in background
Write-Host "[*] Launching UI Engine..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; Write-Host 'CtrlC-Coin Vite Core' -ForegroundColor Magenta; npm run vite"

Start-Sleep -Seconds 3

# 6. Launch Desktop Window 1 (Alice - Port 5000)
Write-Host "[*] Launching Desktop Window 1: Alice (Port 5000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-Command", "cd frontend; npx electron . --port=5000"

# 7. Launch Desktop Window 2: Kevin (Port 5001)
Write-Host "[*] Launching Desktop Window 2: Kevin (Port 5001)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-Command", "cd frontend; npx electron . --port=5001"

Write-Host "`n[SUCCESS] Two native desktop windows launched for Alice (5000) and Kevin (5001). Zero browser tabs." -ForegroundColor Green
