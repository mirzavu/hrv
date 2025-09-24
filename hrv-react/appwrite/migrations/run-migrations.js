#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
    console.log('🚀 Running Appwrite migrations...\n');
    
    // Get all migration files and sort them by name (which includes the number prefix)
    const migrationFiles = fs.readdirSync(__dirname)
        .filter(file => file.match(/^\d{3}_.*\.js$/) && file !== 'run-migrations.js')
        .sort();
    
    if (migrationFiles.length === 0) {
        console.log('No migrations found.');
        return;
    }
    
    console.log(`Found ${migrationFiles.length} migration(s):`);
    migrationFiles.forEach(file => console.log(`  - ${file}`));
    console.log('');
    
    // Run each migration
    for (const file of migrationFiles) {
        console.log(`📦 Running migration: ${file}`);
        try {
            const migrationPath = path.join(__dirname, file);
            await import(migrationPath);
            console.log(`✅ Migration ${file} completed successfully\n`);
        } catch (error) {
            console.error(`❌ Migration ${file} failed:`, error.message);
            console.error('Stopping migration process.\n');
            process.exit(1);
        }
    }
    
    console.log('🎉 All migrations completed successfully!');
}

runMigrations().catch(error => {
    console.error('❌ Migration runner failed:', error);
    process.exit(1);
});
