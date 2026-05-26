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
      // Clientes do tenant que possuem telefone e tiveram agendamento
      // passado que não foi cancelado (independente de estar marcado como Concluido)
      const agora = new Date();
      const clientes = await this.prisma.cliente.findMany({
        where: {
          tenantId: tenant.id,
          telefonePrincipal: { not: '' },
          agendamentos: {
            some: {
              status: {
                notIn: [
                  StatusAgendamento.Cancelado,
                  StatusAgendamento.NaoCompareceu,
                ],
              },
              dataHora: { lt: agora },
            },
          },
        },
        select: {
          id: true,
          nome: true,
          telefonePrincipal: true,
          agendamentos: {
            where: {
              status: {
                notIn: [
                  StatusAgendamento.Cancelado,
                  StatusAgendamento.NaoCompareceu,
                ],
              },
              dataHora: { lt: agora },
            },
            orderBy: { dataHora: 'desc' },
            take: 1,
            select: {
              dataHora: true,
              pet: { select: { nome: true } },
            },
          },
          // Busca se o cliente já tem agendamento futuro para evitar enviar lembrete desnecessário
          _count: {
            select: {
              agendamentos: {
                where: {
                  status: {
                    notIn: [
                      StatusAgendamento.Cancelado,
                      StatusAgendamento.NaoCompareceu,
                    ],
                  },
                  dataHora: { gte: agora },
                },
              },
            },
          },
        },
      });

      let enviados = 0;
      for (const cliente of clientes) {
        if (!cliente.telefonePrincipal) continue;
        const ultimoAgendamento = (cliente as any).agendamentos?.[0];
        if (!ultimoAgendamento) continue;

        // Não envia se o cliente já tem agendamento futuro marcado
        if ((cliente as any)._count?.agendamentos > 0) continue;

        // Só envia se o último agendamento foi há mais de X dias
        if (ultimoAgendamento.dataHora > limiteData) continue;

        const diasPassados = Math.floor(
          (Date.now() - ultimoAgendamento.dataHora.getTime()) /
            (1000 * 60 * 60 * 24),
        );

        const petNome = ultimoAgendamento.pet?.nome ?? 'seu pet';
        const mensagem =
          `Olá, ${cliente.nome}! 👋\n\n` +
          `Aqui é do *${tenant.nome}*. Já faz ${diasPassados} dias desde a última visita do ${petNome} e sentimos muita falta de vocês! 🐾\n\n` +
          `Que tal agendarmos um banho ou uma tosa essa semana? Estamos com horários disponíveis e adoraríamos recebê-los novamente. 😊\n\n` +
          `Responda aqui para marcarmos o horário!`;

        await this.whatsapp.enviar(
          {
            telefone: cliente.telefonePrincipal,
            mensagem,
            clienteId: cliente.id,
            nomeCliente: cliente.nome,
          },
          tenant.id,
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
