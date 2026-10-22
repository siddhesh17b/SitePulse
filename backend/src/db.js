const { PrismaClient } = require('@prisma/client');

let prisma;

try {
  prisma = new PrismaClient();
} catch (err) {
  console.warn('Prisma Client not initialized. Attempting automatic generation...');
  try {
    const { execSync } = require('child_process');
    const path = require('path');
    execSync('npx prisma generate', {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit'
    });
    const { PrismaClient: GeneratedClient } = require('@prisma/client');
    prisma = new GeneratedClient();
  } catch (genErr) {
    console.error('Failed to initialize or generate Prisma Client:', genErr.message);
  }
}

module.exports = prisma;
