import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { AssinaturaStatus, StatusAgendamento } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class AgendaCronService {
  private readonly logger = new Logger(AgendaCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async enviarLembretesRetorno() {
    const diasSemVisita = this.config.get<number>('LEMBRETE_RETORNO_DIAS', 30);

    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasSemVisita);

    // Busca tenants ativos (trial ou assinatura ativa)
    const tenants = await this.prisma.tenant.findMany({
      where: {
        assinaturaStatus: {
          in: [AssinaturaStatus.trial, AssinaturaStatus.ativa],
        },
      },
      select: { id: true, nome: true },
    });

    for (const tenant of tenants) {
      // Clientes do tenant que possuem e-mail e tiveram agendamento concluído
      const clientes = await this.prisma.cliente.findMany({
        where: {
          tenantId: tenant.id,
          email: { not: null },
          agendamentos: {
            some: {
              status: StatusAgendamento.Concluido,
            },
          },
        },
        select: {
          id: true,
          nome: true,
          email: true,
          agendamentos: {
            where: { status: StatusAgendamento.Concluido },
            orderBy: { dataHora: 'desc' },
            take: 1,
            select: {
              dataHora: true,
              pet: { select: { nome: true } },
            },
          },
        },
      });

      let enviados = 0;
      for (const cliente of clientes) {
        if (!cliente.email) continue;
        const ultimoAgendamento = cliente.agendamentos[0];
        if (!ultimoAgendamento) continue;

        // Só envia se o último agendamento foi há mais de X dias
        if (ultimoAgendamento.dataHora > limiteData) continue;

        const diasPassados = Math.floor(
          (Date.now() - ultimoAgendamento.dataHora.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        await this.emailService.enviarLembreteRetorno(
          cliente.email,
          cliente.nome,
          ultimoAgendamento.pet?.nome ?? 'seu pet',
          tenant.nome,
          diasPassados,
        );
        enviados++;
      }

      if (enviados > 0) {
        this.logger.log(
          `[${tenant.nome}] ${enviados} lembrete(s) de retorno enviado(s)`,
        );
      }
    }
  }
}
