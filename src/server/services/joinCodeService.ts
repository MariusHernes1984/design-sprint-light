import { PrismaClient } from '@prisma/client';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 to avoid confusion

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return code;
}

export async function generateUniqueJoinCode(prisma: PrismaClient): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateJoinCode();
    const existing = await prisma.workshop.findUnique({ where: { joinCode: code } });
    if (!existing) return code;
  }
  throw new Error('Kunne ikke generere unik join-kode');
}
