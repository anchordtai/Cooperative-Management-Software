# 🎨 Render Backend Deployment Guide

## Step 1: Prepare Backend for Render

1. **Create render.yaml configuration:**
```yaml
services:
  - type: web
    name: e-cooperative-backend
    env: node
    buildCommand: cd backend && npm install && npm run build
    startCommand: cd backend && npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
```

## Step 2: Deploy to Render

1. **Visit Render Dashboard:**
   - Go to: https://render.com/
   - Sign up/Login with GitHub

2. **Create New Web Service:**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Choose: `anchordtai/Cooperative-Management-Software`

3. **Configure Service:**
   - Name: `e-cooperative-backend`
   - Root Directory: `backend`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`

4. **Set Environment Variables:**
   ```
   NODE_ENV=production
   PORT=10000
   
   # Database (your existing Neon credentials)
   DB_HOST=your_neon_host
   DB_PORT=5432
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password
   DB_SSL=true
   DATABASE_URL=your_neon_connection_string
   PGSSLMODE=require
   
   # JWT Secret
   JWT_SECRET=your_super_secure_jwt_secret
   
   # Email Configuration
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_gmail_app_password
   SMTP_FROM=your_email@gmail.com
   
   # Frontend URL (will be your Netlify URL)
   FRONTEND_URL=https://your-app.netlify.app
   ```

5. **Deploy:**
   - Click "Create Web Service"
   - Render will build and deploy your backend
   - You'll get a URL like: `https://your-backend.onrender.com`
