# E-Cooperative - Cooperative Management SaaS Platform

A comprehensive SaaS solution for cooperative societies to manage their operations, members, finances, and more.

## Features

- Multi-tenant architecture
- Member Management
- Financial Management
- Meeting Management
- Asset Management
- Communication System
- Compliance and Reporting
- User Access Management
- Dashboard and Analytics
- Document Management
- Mobile Application
- Integration Capabilities

## Tech Stack

### Frontend
- React.js
- Material-UI
- Progressive Web App (PWA)
- Redux for state management
- React Router for navigation
- Axios for API calls

### Backend
- Node.js
- Express.js
- PostgreSQL
- Redis for caching
- JWT for authentication
- Docker for containerization

## Project Structure

```
e-cooperative/
├── frontend/           # React frontend application
├── backend/           # Node.js backend application
├── docker/           # Docker configuration files
└── docs/            # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn
- PostgreSQL
- Docker (optional)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install frontend dependencies
   cd frontend
   npm install

   # Install backend dependencies
   cd ../backend
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env` in both frontend and backend directories
   - Update the variables with your configuration

4. Start the development servers:
   ```bash
   # Start backend server
   cd backend
   npm run dev

   # Start frontend server
   cd frontend
   npm start
   ```

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🏢 E-Cooperative Management Software

[![Production Ready](https://img.shields.io/badge/Production-Ready-green.svg)](https://github.com/anchordtai/Cooperative-Management-Software)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18+-blue.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5+-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue.svg)](https://www.postgresql.org/)

A **production-ready** comprehensive cooperative management SaaS platform built with modern web technologies. This full-stack application provides complete member management, financial tracking, loan processing, and administrative tools for cooperative organizations.

## ✨ Features

### 🔐 **Authentication & Security**
- ✅ JWT-based authentication with HTTP-only cookies
- ✅ Email verification with Gmail SMTP integration
- ✅ Phone verification with SMS support
- ✅ Role-based access control (Admin, Staff, Member)
- ✅ Password hashing with bcrypt
- ✅ 2FA support (Email/SMS)

### 👥 **Member Management**
- ✅ Complete member registration and profiles
- ✅ Member status tracking (Active, Inactive, Suspended)
- ✅ Membership number generation
- ✅ Contact information management

### 💰 **Financial Management**
- ✅ Transaction tracking (Deposits, Withdrawals, Contributions)
- ✅ Financial reporting and analytics
- ✅ Balance management
- ✅ Transaction history and audit trails

### 🏦 **Loan Management**
- ✅ Loan application processing
- ✅ Interest rate calculations
- ✅ Repayment tracking
- ✅ Loan status management
- ✅ Payment schedules

### 📊 **Reporting & Analytics**
- ✅ Financial reports
- ✅ Member analytics
- ✅ Transaction summaries
- ✅ Loan performance metrics

## 🛠️ Tech Stack

### **Backend (Node.js/Express/TypeScript)**
- **Framework:** Express.js with TypeScript
- **Database:** PostgreSQL with Sequelize ORM
- **Authentication:** JWT with bcrypt password hashing
- **Email:** Nodemailer with Gmail SMTP
- **Validation:** Express-validator
- **Security:** CORS, Helmet, Rate limiting

### **Frontend (React/TypeScript)**
- **Framework:** React 18 with TypeScript
- **UI Library:** Material-UI (MUI) v5
- **Routing:** React Router v6
- **HTTP Client:** Axios
- **State Management:** React Context API
- **Animations:** Framer Motion

### **Database & Infrastructure**
- **Database:** PostgreSQL (Neon for cloud hosting)
- **ORM:** Sequelize with migrations
- **Environment:** Docker support
- **Deployment:** Ready for Vercel, Netlify, Heroku

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v18 or higher)
- **PostgreSQL** (v15 or higher)
- **npm** or **yarn**
- **Git**

### Installation

1. **Clone the repository:**
```bash
git clone https://github.com/anchordtai/Cooperative-Management-Software.git
cd Cooperative-Management-Software
```

2. **Install backend dependencies:**
```bash
cd backend
npm install
```

3. **Install frontend dependencies:**
```bash
cd ../frontend
npm install
```

4. **Set up environment variables:**

**Backend (.env):**
```env
# Database Configuration (PostgreSQL)
DB_HOST=your_postgres_host
DB_PORT=5432
DB_NAME=cooperative_db
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_SSL=true
DATABASE_URL=postgresql://user:password@host:5432/database
PGSSLMODE=require

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here

# Email Configuration (Gmail SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM=your_email@gmail.com

# Application URLs
FRONTEND_URL=http://localhost:3000
PORT=5000
```

**Frontend (.env):**
```env
REACT_APP_API_URL=http://localhost:5000/api
```

5. **Initialize the database:**
```bash
cd backend
node scripts/create-tables.js
```

6. **Start the development servers:**

**Backend (Terminal 1):**
```bash
cd backend
npm run dev
```

**Frontend (Terminal 2):**
```bash
cd frontend
npm start
```

7. **Access the application:**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api

## 📋 Production Deployment

### **Backend Deployment (Heroku/Railway/Render)**

1. Set environment variables in your hosting platform
2. Ensure PostgreSQL database is configured
3. Run database initialization: `node scripts/create-tables.js`
4. Deploy with: `npm run build && npm start`

### **Frontend Deployment (Vercel/Netlify)**

1. Set `REACT_APP_API_URL` to your production backend URL
2. Build the app: `npm run build`
3. Deploy the `build` folder

### **Database Setup (Production)**

**Recommended: Neon PostgreSQL**
```bash
# Create account at neon.tech
# Create new project
# Copy connection string to DATABASE_URL
```

## 🔧 Configuration

### **Gmail SMTP Setup**

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the generated password in `SMTP_PASS`

### **Database Configuration**

**Local PostgreSQL:**
```bash
# Install PostgreSQL
# Create database: createdb cooperative_db
# Update .env with local credentials
```

**Cloud PostgreSQL (Neon):**
```bash
# Sign up at neon.tech
# Create new project
# Copy connection details to .env
```

## 📚 API Documentation

### **Authentication Endpoints**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/verify-email` - Verify email
- `POST /api/auth/verify-phone` - Verify phone

### **Member Management**
- `GET /api/members` - List all members
- `POST /api/members` - Create new member
- `GET /api/members/:id` - Get member details
- `PUT /api/members/:id` - Update member
- `DELETE /api/members/:id` - Delete member

### **Financial Management**
- `GET /api/transactions` - List transactions
- `POST /api/transactions` - Create transaction
- `GET /api/financial/summary` - Financial summary

### **Loan Management**
- `GET /api/loans` - List loans
- `POST /api/loans` - Create loan application
- `PUT /api/loans/:id` - Update loan status

## 🧪 Testing

```bash
# Run backend tests
cd backend
npm test

# Run frontend tests
cd frontend
npm test
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- 📧 Email: support@cooperative-management.com
- 🐛 Issues: [GitHub Issues](https://github.com/anchordtai/Cooperative-Management-Software/issues)
- 📖 Documentation: [Wiki](https://github.com/anchordtai/Cooperative-Management-Software/wiki)

## 🎯 Roadmap

- [ ] Mobile app (React Native)
- [ ] Advanced reporting dashboard
- [ ] Integration with payment gateways
- [ ] Multi-language support
- [ ] Advanced loan calculators
- [ ] Automated backup system

---

**Built with ❤️ for Cooperative Organizations** - see the LICENSE file for details. #   C o o p e r a t i v e - M a n a g e m e n t - S o f t w a r e  
 