@echo off
echo 🐳 Co-opSphere Docker Cleanup Script
echo =======================================

echo.
echo 🛑 Stopping all Co-opSphere containers...
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
