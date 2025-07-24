@echo off
echo 🚀 Deploying E-Cooperative Management Software to Netlify...

echo.
echo 📦 Installing Netlify CLI...
npm install -g netlify-cli

echo.
echo 🔑 Login to Netlify (this will open your browser)...
netlify login

echo.
echo 🏗️ Building frontend...
cd frontend
npm run build

echo.
echo 🚀 Deploying to Netlify...
netlify deploy --prod --dir=build

echo.
echo ✅ Deployment complete!
echo 🌐 Your app is now live on Netlify!

pause
