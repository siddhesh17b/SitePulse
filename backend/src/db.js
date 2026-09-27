const { PrismaClient } = require('@prisma/client');

let prisma;

try {
  prisma = new PrismaClient();
} catch (err) {
  console.error('Failed to initialize Prisma Client:', err);
}

module.exports = prisma;
