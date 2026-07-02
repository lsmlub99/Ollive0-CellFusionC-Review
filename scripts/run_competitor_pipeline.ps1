$REPO = "C:\oliveyounginsight\Ollive0-CellFusionC-Review"
$LOG_DIR = "$REPO\logs"
if (-not (Test-Path $LOG_DIR)) { New-Item -ItemType Directory -Path $LOG_DIR | Out-Null }
$transcript = "$LOG_DIR\run_competitor_pipeline_$(Get-Date -Format 'yyyyMMdd_HHmmss').transcript"
Start-Transcript -Path $transcript -Append -Force | Out-Null
try {
    . "$REPO\scripts\_common.ps1"
    Invoke-Collector -module "collector.competitor_pipeline" -label "CompetitorPipeline" -timeoutMin 60
} catch {
    Write-Host "FATAL: $_"
} finally {
    Stop-Transcript | Out-Null
}
