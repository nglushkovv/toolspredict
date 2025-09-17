@echo off
cd /d %~dp0
call venv\Scripts\Activate
python -m uvicorn app.main:app --reload --host 0.0.0.0
pause
