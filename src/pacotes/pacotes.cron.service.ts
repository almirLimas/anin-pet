import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AssinaturaStatus, Plano, StatusPacoteCliente } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class PacotesCronService {
  private readonly logger = new Logger(PacotesCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron('0 13 * * *', { timeZone: 'America/Sao_Paulo' }) // 10h horário de Brasília
  async avisarPacotesVencendo() {
    this.logger.log('[PacotesVencendo] Cron iniciado');

    const daqui3dias = new Date();
    daqui3dias.setDate(daqui3dias.getDate() + 3);
    daqui3dias.setHours(23, 59, 59, 999);

    // Tenants Plus ativos/trial
    const tenants = await this.prisma.tenant.findMany({
      where: {
        plano: Plano.plus,
        assinaturaStatus: {
          in: [AssinaturaStatus.trial, AssinaturaStatus.ativa],
        },
      },
      select: { id: true, nome: true },
    });

    if (tenants.length === 0) {
      this.logger.log('[PacotesVencendo] Nenhum tenant Plus encontrado');
      return;
    }

    const tenantIds = tenants.map((t) => t.id);
    const tenantNomes = Object.fromEntries(tenants.map((t) => [t.id, t.nome]));

    const pacotes = await this.prisma.pacoteClienteAtivo.findMany({
      where: {
        tenantId: { in: tenantIds },
        status: StatusPacoteCliente.Ativo,
        expiraEm: { lte: daqui3dias },
        aviso3dEnviadoEm: null,
      },
      include: {
        cliente: { select: { nome: true, telefonePrincipal: true } },
        pacote: { select: { nome: true } },
      },
    });

    this.logger.log(
      `[PacotesVencendo] ${pacotes.length} pacote(s) para avisar`,
    );

    for (const p of pacotes) {
      const telefone = p.cliente.telefonePrincipal;
      if (!telefone) {
        await this.prisma.pacoteClienteAtivo.update({
          where: { id: p.id },
          data: { aviso3dEnviadoEm: new Date() },
        });
        continue;
      }

      const diasRestantes = Math.max(
        0,
        Math.ceil((p.expiraEm.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      );
      const sessoesRestantes = p.totalSessoes - p.sessoesUsadas;
      const nomePetshop = tenantNomes[p.tenantId] ?? 'Petshop';

      const mensagem =
        `Oi, ${p.cliente.nome}! 🐾 Seu pacote *${p.pacote.nome}* vence em *${diasRestantes} dia(s)*.\n\n` +
        (sessoesRestantes > 0
          ? `Você ainda tem *${sessoesRestantes} sessão(ões)* disponível(eis).\n\n`
          : '') +
        `Renove com a gente no ${nomePetshop}! 😊`;

      await this.whatsapp
        .enviar({ telefone, mensagem, nomeCliente: p.cliente.nome }, p.tenantId)
        .catch((err: unknown) =>
          this.logger.error(
            `[PacotesVencendo] Falha para ${p.cliente.nome}: ${String(err)}`,
          ),
        );

      await this.prisma.pacoteClienteAtivo.update({
        where: { id: p.id },
        data: { aviso3dEnviadoEm: new Date() },
      });
    }

    this.logger.log('[PacotesVencendo] Cron finalizado');
  }
}
