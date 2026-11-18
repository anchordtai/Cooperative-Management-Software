import 'dotenv/config';
import { Sequelize, Options } from 'sequelize';
import pg from 'pg';

const options: Options = {
  dialect: 'postgres',
  dialectModule: pg,
  logging: false,
  dialectOptions: process.env.DB_SSL === 'true' ? {
    ssl: {
      rejectUnauthorized: true,
      ...(process.env.DB_SSL_CA ? { ca: process.env.DB_SSL_CA } : {})
    }
  } : {},
  pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
};

const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, options)
  : new Sequelize({
    ...options,
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_NAME || 'e_cooperative',
    username: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  });

export default sequelize;
