# 🚂 Railway Backend Deployment Guide

## Step 1: Prepare Backend for Railway

1. **Create railway.json configuration:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "npm start",
    "healthcheckPath": "/api/health"
  }
}
```

2. **Add health check endpoint to your backend:**
Add this to your `backend/src/index.ts`:
```typescript
// Health check endpoint for Railway
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'E-Cooperative Backend'
  });
});
```

## Step 2: Deploy to Railway

1. **Visit Railway Dashboard:**
   - Go to: https://railway.app/
   - Sign up/Login with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose: `anchordtai/Cooperative-Management-Software`

3. **Configure Service:**
   - Root Directory: `backend`
   - Build Command: `npm run build`
   - Start Command: `npm start`

4. **Set Environment Variables:**
   ```
   NODE_ENV=production
   PORT=5000
   
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
   - Click "Deploy"
   - Railway will build and deploy your backend
   - You'll get a URL like: `https://your-backend.railway.app`

## Step 3: Initialize Database

After deployment, run the database initialization:
```bash
# SSH into Railway container or use Railway CLI
railway run node scripts/create-tables.js
```

## Step 4: Update Frontend Environment

Update your Netlify environment variables:
```
REACT_APP_API_URL=https://your-backend.railway.app/api
```
