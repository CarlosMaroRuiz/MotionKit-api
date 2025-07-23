import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Crear componente premium si no existe
  await prisma.component.upsert({
    where: { id: 'premium-access' },
    update: {},
    create: {
      id: 'premium-access',
      name: 'Premium Access',
      jsxCode: '// This is a virtual component for premium access tracking',
      type: 'premium',
      animationCode: null,
    },
  });

  console.log('Premium component created successfully');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });