import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create a default facilitator
  const passwordHash = await bcrypt.hash('admin123', 12);

  await prisma.facilitator.upsert({
    where: { email: 'admin@atea.no' },
    update: {},
    create: {
      email: 'admin@atea.no',
      name: 'Admin Fasilitator',
      passwordHash,
    },
  });

  console.log('Seed fullfort! Fasilitator: admin@atea.no / admin123');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
