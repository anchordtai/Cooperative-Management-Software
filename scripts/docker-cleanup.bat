@echo off
echo 🐳 E-Cooperative Docker Cleanup Script
echo =======================================

echo.
echo 🛑 Stopping all E-Cooperative containers...
docker-compose down

echo.
echo 🗑️ Removing containers, networks, and images...
docker-compose down --rmi all --volumes --remove-orphans

echo.
echo ✅ Cleanup completed!
echo.
echo ⚠️  Note: This removes all data. To restart:
echo    Run: scripts\docker-setup.bat
echo.
pause
