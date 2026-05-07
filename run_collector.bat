@echo off
cd /d "c:\claude_CMSLAB\cellfusion-reviews"

set LOG_FILE=logs\collector_%date:~0,4%%date:~5,2%%date:~8,2%.txt
if not exist logs mkdir logs

echo [%date% %time%] 수집 시작 >> %LOG_FILE%
python -m collector.pipeline >> %LOG_FILE% 2>&1
echo [%date% %time%] 수집 완료 >> %LOG_FILE%
