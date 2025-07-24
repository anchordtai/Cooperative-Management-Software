-- E-Cooperative Database Setup Script for PostgreSQL
-- Run this script after installing PostgreSQL

-- Create database (run this as postgres superuser)
CREATE DATABASE e_cooperative;

-- Create a dedicated user for the application (optional but recommended)
CREATE USER e_coop_user WITH PASSWORD 'secure_password_123';

-- Grant privileges to the user
GRANT ALL PRIVILEGES ON DATABASE e_cooperative TO e_coop_user;

-- Connect to the e_cooperative database
\c e_cooperative;

-- Grant schema privileges
GRANT ALL ON SCHEMA public TO e_coop_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO e_coop_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO e_coop_user;

-- Enable UUID extension (required for User model)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Verify setup
SELECT current_database(), current_user;
