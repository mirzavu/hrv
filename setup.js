#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Setting up HRV Analysis App...\n');

// Function to copy environment files
function copyEnvFile(source, destination) {
  try {
    if (fs.existsSync(source)) {
      fs.copyFileSync(source, destination);
      console.log(`✅ Copied ${source} to ${destination}`);
    } else {
      console.log(`⚠️  Source file ${source} not found`);
    }
  } catch (error) {
    console.log(`❌ Error copying ${source}: ${error.message}`);
  }
}

// Function to install dependencies
function installDependencies(directory) {
  try {
    console.log(`📦 Installing dependencies in ${directory}...`);
    execSync('npm install', { cwd: directory, stdio: 'inherit' });
    console.log(`✅ Dependencies installed in ${directory}`);
  } catch (error) {
    console.log(`❌ Error installing dependencies in ${directory}: ${error.message}`);
  }
}

// Main setup process
async function setup() {
  console.log('📁 Creating environment files...');
  
  // Copy environment files
  copyEnvFile('frontend/env.development', 'frontend/.env.development');
  copyEnvFile('frontend/env.production', 'frontend/.env.production');
  copyEnvFile('backend/env.development', 'backend/.env.development');
  copyEnvFile('backend/env.production', 'backend/.env.production');
  
  console.log('\n📦 Installing root dependencies...');
  installDependencies('.');
  
  console.log('\n📦 Installing frontend dependencies...');
  installDependencies('frontend');
  
  console.log('\n📦 Installing backend dependencies...');
  installDependencies('backend');
  
  console.log('\n🎉 Setup complete!');
  console.log('\n📋 Next steps:');
  console.log('1. Update environment variables in .env files as needed');
  console.log('2. Run "npm run dev" to start both frontend and backend');
  console.log('3. Open http://localhost:3001 in your browser');
  console.log('4. Connect your Polar H10 device and start monitoring!');
  console.log('\n📚 For more information, see README.md');
}

// Run setup
setup().catch(console.error); 