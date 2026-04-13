import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async gerarGoogleAdsCsv(): Promise<string> {
    const usuarios = await this.prisma.usuario.findMany({
      where: { perfil: 'admin' },
      select: {
        nomeCompleto: true,
        email: true,
        telefone: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const linhas: string[] = [
      'Email Address,Phone Number,First Name,Last Name,Country',
    ];

    for (const u of usuarios) {
      const email = (u.email ?? '').trim().toLowerCase();
      const telefone = formatarTelefone(u.telefone);
      const { firstName, lastName } = splitNome(u.nomeCompleto);

      linhas.push(
        [
          csvEscape(email),
          csvEscape(telefone),
          csvEscape(firstName),
          csvEscape(lastName),
          'BR',
        ].join(','),
      );
    }

    return linhas.join('\n');
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function splitNome(nomeCompleto: string): {
  firstName: string;
  lastName: string;
} {
  const partes = nomeCompleto.trim().split(/\s+/);
  if (partes.length === 1) return { firstName: partes[0], lastName: '' };
  const [firstName, ...resto] = partes;
  return { firstName, lastName: resto.join(' ') };
}

function formatarTelefone(telefone: string | null): string {
  if (!telefone) return '';
  const digitos = telefone.replaceAll(/\D/g, '');
  if (digitos.length === 0) return '';
  // Já tem código de país (55 + 10 ou 11 dígitos)
  if (digitos.startsWith('55') && digitos.length >= 12) return `+${digitos}`;
  // Sem código de país
  return `+55${digitos}`;
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}
