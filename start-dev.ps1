# Start-DevServer.ps1
# Verifica y activa el servidor de desarrollo en localhost:3002
# Uso: .\start-dev.ps1

$PORT = 3002
$URL = "http://localhost:$PORT"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Sellvende Leads - Dev Server Check" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Check if port is already in use
$existingProcess = Get-NetTCPConnection -LocalPort $PORT -ErrorAction SilentlyContinue | Select-Object -First 1

if ($existingProcess) {
    Write-Host "[✓] Puerto $PORT ya está en uso (PID: $($existingProcess.OwningProcess))" -ForegroundColor Green
    
    # Verify server is actually responding
    try {
        $response = Invoke-WebRequest -Uri $URL -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "[✓] Servidor respondiendo correctamente en $URL" -ForegroundColor Green
            Write-Host "`n¡Listo! Abre $URL en tu navegador.`n" -ForegroundColor Yellow
            exit 0
        }
    } catch {
        Write-Host "[!] Puerto ocupado pero servidor no responde. Reiniciando..." -ForegroundColor Yellow
        Stop-Process -Id $existingProcess.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
}

Write-Host "[*] Iniciando servidor de desarrollo..." -ForegroundColor Yellow

# Kill any existing vite/node processes on this port
Get-Process | Where-Object { $_.ProcessName -match "node|vite" } | ForEach-Object {
    $ports = Get-NetTCPConnection -OwningProcess $_.Id -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq $PORT }
    if ($ports) {
        Write-Host "    Deteniendo proceso existente (PID: $($_.Id))..." -ForegroundColor DarkYellow
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    }
}

Start-Sleep -Seconds 1

# Start dev server in background
Write-Host "[*] Ejecutando npm run dev..." -ForegroundColor Yellow
$process = Start-Process -FilePath "npm" -ArgumentList "run", "dev" -WindowStyle Hidden -PassThru

Write-Host "[*] PID del servidor: $($process.Id)" -ForegroundColor DarkYellow

# Wait for server to be ready
$retries = 0
$maxRetries = 15

while ($retries -lt $maxRetries) {
    Start-Sleep -Seconds 2
    $retries++
    Write-Host "    Verificando... ($retries/$maxRetries)" -ForegroundColor DarkGray
    
    try {
        $response = Invoke-WebRequest -Uri $URL -UseBasicParsing -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "`n[✓] Servidor listo en $URL (intentos: $retries)" -ForegroundColor Green
            Write-Host "`n¡Listo! Abre $URL en tu navegador.`n" -ForegroundColor Yellow
            exit 0
        }
    } catch {
        # Server not ready yet, continue waiting
        continue
    }
}

Write-Host "`n[✗] Timeout: El servidor no respondió después de $($maxRetries * 2) segundos" -ForegroundColor Red
Write-Host "    Verifica la consola para ver si hay errores.`n" -ForegroundColor Red
exit 1
