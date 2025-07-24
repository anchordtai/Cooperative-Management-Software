@echo off
echo 🆓 FREE Deployment Script for E-Cooperative Management Software
echo ================================================================

echo.
echo 🎯 Choose your FREE deployment option:
echo.
echo 1. Vercel + Railway (RECOMMENDED - Most generous free tiers)
echo 2. Netlify + Render (Alternative free option)
echo 3. Manual deployment instructions
echo.

set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto vercel_railway
if "%choice%"=="2" goto netlify_render
if "%choice%"=="3" goto manual
goto invalid

:vercel_railway
echo.
echo 🚀 Setting up Vercel + Railway deployment...
echo.
echo 📦 Installing deployment tools...
npm install -g vercel @railway/cli

echo.
echo 🔑 Please follow these steps:
echo.
echo 1. FRONTEND (Vercel):
echo    - Go to https://vercel.com/
echo    - Sign up with GitHub
echo    - Import your repository: anchordtai/Cooperative-Management-Software
echo    - Set Root Directory: frontend
echo    - Deploy!
echo.
echo 2. BACKEND (Railway):
echo    - Go to https://railway.app/
echo    - Sign up with GitHub
echo    - Deploy from GitHub repo
echo    - Set Root Directory: backend
echo    - Add your environment variables
echo    - Deploy!
echo.
echo 3. Connect them:
echo    - Copy Railway backend URL
echo    - Add to Vercel environment: REACT_APP_API_URL=https://your-backend.railway.app/api
echo.
goto end

:netlify_render
echo.
echo 🚀 Setting up Netlify + Render deployment...
echo.
echo 📦 Installing Netlify CLI...
npm install -g netlify-cli

echo.
echo 🔑 Please follow these steps:
echo.
echo 1. FRONTEND (Netlify):
echo    - Go to https://app.netlify.com/
echo    - New site from Git
echo    - Choose your repository
echo    - Set Base directory: frontend
echo    - Deploy!
echo.
echo 2. BACKEND (Render):
echo    - Go to https://render.com/
echo    - New Web Service
echo    - Connect GitHub repository
echo    - Set Root Directory: backend
echo    - Add environment variables
echo    - Deploy!
echo.
goto end

:manual
echo.
echo 📖 Opening deployment guides...
start https://github.com/anchordtai/Cooperative-Management-Software/blob/main/FREE_DEPLOYMENT_GUIDE.md
goto end

:invalid
echo.
echo ❌ Invalid choice. Please run the script again.
goto end

:end
echo.
echo ✅ Deployment setup complete!
echo 📖 For detailed instructions, see: FREE_DEPLOYMENT_GUIDE.md
echo 🌐 Your app will be live at:
echo    - Frontend: https://your-app.vercel.app (or .netlify.app)
echo    - Backend: https://your-backend.railway.app (or .onrender.com)
echo.
pause
