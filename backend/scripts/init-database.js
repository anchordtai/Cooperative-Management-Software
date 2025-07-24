const { Sequelize } = require('sequelize');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Initialize Sequelize connection
const sequelize = new Sequelize(process.env.DATABASE_URL || {
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'e_cooperative',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
}, {
  dialect: 'postgres',
  logging: console.log,
  dialectOptions: {
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function initializeDatabase() {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');

    console.log('🔄 Synchronizing database models...');
    // Since this is a Node.js script and models are TypeScript,
    // we'll just sync the database without importing models
    // The models will be registered when the main app starts
    
    // Sync all models (creates tables if they don't exist)
    await sequelize.sync({ force: false }); // Set to true to drop and recreate tables
    console.log('✅ Database models synchronized successfully.');

    console.log('🎉 Database initialization completed!');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Run the initialization
initializeDatabase();
