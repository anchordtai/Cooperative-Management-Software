@echo off
echo 🐳 E-Cooperative Docker Setup Script
echo =====================================

echo.
echo 🔄 Starting PostgreSQL with Docker Compose...
docker-compose up -d postgres

echo.
echo ⏳ Waiting for PostgreSQL to be ready...
timeout /t 10

echo.
echo 🔄 Checking PostgreSQL health...
docker-compose ps postgres

echo.
echo 📊 Starting pgAdmin (Database Management UI)...
docker-compose up -d pgadmin

echo.
echo ✅ Docker setup completed!
echo.
echo 📋 Services Information:
echo    - PostgreSQL: localhost:5432
echo    - pgAdmin: http://localhost:8080
echo      Email: admin@ecooperative.com
echo      Password: admin123
echo.
echo 🔧 Next steps:
echo    1. Run: npm run db:init (to create tables)
echo    2. Run: npm run dev (to start backend)
echo.
pause
