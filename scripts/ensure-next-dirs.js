#!/usr/bin/env node
const { mkdir } = require('fs/promises');
const { join, dirname } = require('path');

const projectRoot = join(__dirname, '..');

const dirs = [
  join(projectRoot, '.next/static/development'),
];

async function ensureDirs() {
  for (const dir of dirs) {
    try {
      await mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore EEXIST errors
      if (error.code !== 'EEXIST') {
        console.error(`Error creating directory ${dir}:`, error);
      }
    }
  }
}

ensureDirs().catch(console.error);

