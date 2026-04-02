import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

// Carrega .env manualmente sem dependência do dotenv
import { readFileSync } from 'fs';
import { join } from 'path';

try {
  const env = readFileSync(join(__dirname, '..', '.env'), 'utf-8');
  for (const line of env.split('\n')) {
    const [key, ...rest] = line.split('=');
    if (key && rest.length)
      process.env[key.trim()] = rest.join('=').trim().replace(/^"|"$/g, '');
  }
} catch {}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'admin@aninpet.com';

  // Sempre garante que o tenant master está com plano plus e ativa
  const tenant = await prisma.tenant.upsert({
    where: { id: 'default-tenant-0000000000' },
    update: {
      plano: 'plus',
      assinaturaStatus: 'ativa',
    },
    create: {
      id: 'default-tenant-0000000000',
      nome: 'Anin Pet (Master)',
      plano: 'plus',
      assinaturaStatus: 'ativa',
    },
  });

  const existe = await prisma.usuario.findUnique({ where: { email } });

  if (existe) {
    console.log('✅ Usuário admin já existe, tenant atualizado.');
    return;
  }

  const senhaHash = await bcrypt.hash('admin123', 10);

  await prisma.usuario.create({
    data: {
      nomeCompleto: 'Administrador',
      email,
      senhaHash,
      perfil: 'admin',
      status: 'ativo',
      tenantId: tenant.id,
    },
  });

  console.log('🐾 Usuário admin criado com sucesso!');
  console.log('   E-mail: admin@aninpet.com');
  console.log('   Senha:  admin123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
