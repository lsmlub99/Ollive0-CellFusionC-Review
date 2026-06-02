@echo off
chcp 65001 > nul
cd /d "c:\oliveyounginsight\Ollive0-CellFusionC-Review"

set PYTHONIOENCODING=utf-8
set LOG_FILE=logs\coupang_summarizer_%date:~0,4%%date:~5,2%%date:~8,2%.txt
if not exist logs mkdir logs

echo [%date% %time%] coupang summarizer start >> %LOG_FILE%
"C:\Program Files\Python312\python.exe" -u -m collector.coupang_summarizer >> %LOG_FILE% 2>&1
echo [%date% %time%] coupang summarizer done >> %LOG_FILE%
