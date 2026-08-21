$ErrorActionPreference = "Stop"

Write-Host "GEAR ONE-COMMAND STARTUP" -ForegroundColor Cyan

# 1. Start Infrastructure
Write-Host "Starting Infrastructure (Postgres, Neo4j, Redis)..."
cd infra\compose
docker-compose up -d
cd ..\..

Write-Host "Waiting for infrastructure to be healthy (10 seconds)..."
Start-Sleep -Seconds 10

# 2. Python Environment
Write-Host "Setting up Python Environment..."
if (-Not (Test-Path "venv")) {
    python -m venv venv
}
.\venv\Scripts\Activate.ps1
pip install -r apps\api\requirements.txt

# 3. Start FastAPI Backend
Write-Host "Starting FastAPI Backend..."
$apiProcess = Start-Process -FilePath "..\..\venv\Scripts\python.exe" -ArgumentList "-m", "uvicorn", "main:app", "--reload", "--port", "8000" -WorkingDirectory "apps\api" -WindowStyle Minimized -PassThru

# 4. Start Celery Worker
Write-Host "Starting Celery Worker..."
$celeryProcess = Start-Process -FilePath "..\..\venv\Scripts\python.exe" -ArgumentList "-m", "celery", "-A", "workers.celery_app", "worker", "-l", "info", "-P", "solo" -WorkingDirectory "apps\api" -WindowStyle Minimized -PassThru

# Wait for API to come online
Write-Host "Waiting for FastAPI to become reachable..."
$retries = 0
$apiReady = $false
while ($retries -lt 15) {
    try {
        $response = Invoke-RestMethod -Uri "http://localhost:8000/api/v1/health" -Method Get -ErrorAction Stop
        if ($response.status -eq "ok") {
            $apiReady = $true
            break
        }
    } catch {
        Start-Sleep -Seconds 2
        $retries++
    }
}

if ($apiReady) {
    Write-Host "Backend is UP and running at http://localhost:8000" -ForegroundColor Green
} else {
    Write-Host "Failed to verify backend health." -ForegroundColor Red
}

Write-Host "Done! Infrastructure, Backend, and Celery are running." -ForegroundColor Cyan
Write-Host "API Process ID: $($apiProcess.Id)"
Write-Host "Celery Process ID: $($celeryProcess.Id)"
