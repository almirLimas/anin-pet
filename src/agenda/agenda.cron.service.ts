import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import {
  AssinaturaStatus,
  Plano,
  Prisma,
  StatusAgendamento,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AgendaCronService {
  private readonly logger = new Logger(AgendaCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
    private readonly whatsapp: WhatsappService,
  ) {}

  @Cron('0 15 * * *', { timeZone: 'America/Sao_Paulo' }) // 12h (meio-dia) horário de Brasília
  async enviarLembretesRetorno() {
    this.logger.log('[LembreteRetorno] Cron iniciado');
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

      this.logger.log(
        `[${tenant.nome}] ${enviados} lembrete(s) de retorno enviado(s) (${clientes.length} cliente(s) elegíveis)`,
      );
    }
    this.logger.log('[LembreteRetorno] Cron finalizado');
  }

  @Cron('0 12 * * *', { timeZone: 'America/Sao_Paulo' }) // 9h horário de Brasília
  async enviarLembretesAgendamentoDia() {
    this.logger.log('[LembreteAgendamento] Cron iniciado');

    // Intervalo: amanhã das 00:00 às 23:59
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    const inicio = new Date(amanha);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(amanha);
    fim.setHours(23, 59, 59, 999);

    // Busca IDs dos tenants Plus ativos/trial
    const tenants = await this.prisma.tenant.findMany({
      where: {
        plano: Plano.plus,
        assinaturaStatus: {
          in: [AssinaturaStatus.trial, AssinaturaStatus.ativa],
        },
      },
      select: { id: true, nome: true },
    });
    const tenantIds = tenants.map((t) => t.id);
    const tenantNomes = Object.fromEntries(tenants.map((t) => [t.id, t.nome]));

    if (tenantIds.length === 0) {
      this.logger.log('[LembreteAgendamento] Nenhum tenant Plus encontrado');
      return;
    }

    const agendamentoInclude = {
      cliente: { select: { nome: true, telefonePrincipal: true } },
      pet: { select: { nome: true } },
      servicos: { include: { servico: { select: { nome: true } } } },
    } satisfies Prisma.AgendamentoInclude;

    type AgComRelacoes = Prisma.AgendamentoGetPayload<{
      include: typeof agendamentoInclude;
    }>;

    // Apenas tenants Plus com assinatura ativa ou em trial
    const agendamentos = (await this.prisma.agendamento.findMany({
      where: {
        status: StatusAgendamento.Agendado,
        dataHora: { gte: inicio, lte: fim },
        tenantId: { in: tenantIds },
      },
      include: agendamentoInclude,
    })) as AgComRelacoes[];

    this.logger.log(
      `[LembreteAgendamento] ${agendamentos.length} agendamento(s) encontrado(s) para amanhã`,
    );

    for (const ag of agendamentos) {
      const telefone = ag.cliente.telefonePrincipal;
      if (!telefone) continue;

      const hora = ag.dataHora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      });
      const nomesServicos = ag.servicos.map((s) => s.servico.nome).join(', ');
      const nomeTenant = tenantNomes[ag.tenantId] ?? 'Petshop';

      const mensagem = `Oi, ${ag.cliente.nome}! 🐾 Lembrando que amanhã às ${hora} o ${ag.pet.nome} tem ${nomesServicos} agendado no ${nomeTenant}.\n\nAté lá! 😊`;

      await this.whatsapp
        .enviar(
          { telefone, mensagem, nomeCliente: ag.cliente.nome },
          ag.tenantId,
        )
        .catch((err: unknown) =>
          this.logger.error(
            `[LembreteAgendamento] Falha ao enviar para ${ag.cliente.nome}: ${String(err)}`,
          ),
        );
    }

    this.logger.log('[LembreteAgendamento] Cron finalizado');
  }
}
