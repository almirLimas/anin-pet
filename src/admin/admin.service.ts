import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Todo dia 22 à meia-noite: ativa aviso PIX para tenants sem assinatura por cartão
  @Cron('0 0 22 * *')
  async ativarAvisoPixMensal() {
    const tenants = await this.prisma.tenant.findMany({
      where: {
        assinaturaStatus: { in: ['ativa', 'trial'] },
        mpAssinaturaId: null, // apenas quem NÃO paga por cartão (PreApproval)
      },
      select: { id: true },
    });

    for (const t of tenants) {
      await this.ativarAvisoPix(t.id, 72); // 72h para pagar
    }

    this.logger.log(`Aviso PIX mensal ativado para ${tenants.length} tenant(s)`);
  }

  async ativarAvisoPix(tenantId: string, horas = 48) {
    const ate = new Date(Date.now() + horas * 60 * 60 * 1000);
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { avisoPixAte: ate },
    });
    return { tenantId, avisoPixAte: ate.toISOString() };
  }

  async desativarAvisoPix(tenantId: string) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { avisoPixAte: null },
    });
    return { tenantId, avisoPixAte: null };
  }

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
