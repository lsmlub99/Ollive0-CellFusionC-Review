@echo off
chcp 65001 > nul
cd /d "c:\claude_CMSLAB\cellfusion-reviews"

set PYTHONIOENCODING=utf-8
set LOG_FILE=logs\collector_%date:~0,4%%date:~5,2%%date:~8,2%.txt
if not exist logs mkdir logs

echo [%date% %time%] 수집 시작 >> %LOG_FILE%
"C:\Program Files\Python311\python.exe" -m collector.pipeline >> %LOG_FILE% 2>&1
echo [%date% %time%] 수집 완료 >> %LOG_FILE%
