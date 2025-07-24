import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Use Neon connection with proper SSL configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'e_cooperative',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
      sslmode: 'require'
    }
  },
  ssl: true,
  native: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

export const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  }
};

export default sequelize;

export const smtpConfig = {
  host: process.env.SMTP_HOST || 'smtp.yourprovider.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  user: process.env.SMTP_USER || 'your_smtp_user',
  pass: process.env.SMTP_PASS || 'your_smtp_password',
  from: process.env.SMTP_FROM || 'E-Cooperative <no-reply@ecooperative.com>',
};