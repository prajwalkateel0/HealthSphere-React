@echo off
echo Starting HealthSphere...
echo.
echo [1/2] Starting Backend API (port 5000)...
start "HealthSphere Backend" cmd /k "cd backend && npm run dev"
timeout /t 3 /nobreak >nul
echo [2/2] Starting Frontend (port 5173)...
start "HealthSphere Frontend" cmd /k "cd frontend && npm run dev"
echo.
echo HealthSphere is starting!
echo.
echo  Backend: http://localhost:5002
echo  Frontend: http://localhost:5175
echo.
echo Demo accounts (password: "password"):
echo  Patient:    emma.patel007@gmail.com
echo  Doctor:     doctor@healthsphere.com
echo  Admin:      admin@healthsphere.com
echo  Government: govt@healthsphere.com
pause
