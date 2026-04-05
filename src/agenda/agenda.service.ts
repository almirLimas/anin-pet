import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
    private readonly whatsapp: WhatsappService,
  ) {}

  private get include() {
    return {
      cliente: { select: { id: true, nome: true, telefonePrincipal: true } },
      pet: { select: { id: true, nome: true, especie: true } },
      servico: {
        select: { id: true, nome: true, preco: true, duracaoMinutos: true },
      },
    };
  }

  async findAll(tenantId: string, data?: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };

    if (data) {
      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59.999`);
      where['dataHora'] = { gte: inicio, lte: fim };
    }

    if (status) {
      where['status'] = status;
    }

    return this.prisma.agendamento.findMany({
      where,
      orderBy: { dataHora: 'asc' },
      include: this.include,
    });
  }

  async findOne(tenantId: string, id: string) {
    const agendamento = await this.prisma.agendamento.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    return agendamento;
  }

  async create(tenantId: string, dto: CreateAgendamentoDto) {
    const agendamento = await this.prisma.agendamento.create({
      data: {
        ...dto,
        tenantId,
        dataHora: new Date(dto.dataHora),
      },
      include: this.include,
    });

    // Notificação WhatsApp ao cliente (somente plano Plus)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plano: true },
    });
    const telefone = agendamento.cliente.telefonePrincipal;
    if (telefone && tenant?.plano === 'plus') {
      const dataFormatada = agendamento.dataHora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
      const horaFormatada = agendamento.dataHora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const mensagem =
        `Olá, ${agendamento.cliente.nome}! 🐾 Seu agendamento foi confirmado.\n` +
        `Pet: ${agendamento.pet.nome}\n` +
        `Serviço: ${agendamento.servico.nome}\n` +
        `Data: ${dataFormatada} às ${horaFormatada}\n` +
        `Até lá! 😊`;

      this.whatsapp
        .enviar(
          { telefone, mensagem, nomeCliente: agendamento.cliente.nome },
          tenantId,
        )
        .catch((err: unknown) =>
          this.logger.error(`Falha ao notificar WhatsApp: ${String(err)}`),
        );
    }

    return agendamento;
  }

  async update(tenantId: string, id: string, dto: UpdateAgendamentoDto) {
    await this.findOne(tenantId, id);
    const atualizado = await this.prisma.agendamento.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dataHora && { dataHora: new Date(dto.dataHora) }),
      } as Prisma.AgendamentoUncheckedUpdateInput,
      include: this.include,
    });

    // Auto-lançamento financeiro ao concluir
    if (dto.status === 'Concluido') {
      const jaExiste = await this.prisma.lancamento.findFirst({
        where: { agendamentoId: id },
      });
      if (!jaExiste) {
        await this.financeiro.criar(
          {
            tipo: 'Receita',
            valor: Number(atualizado.servico.preco),
            descricao: `${atualizado.servico.nome} — ${atualizado.pet.nome}`,
            categoria: 'Servico',
            agendamentoId: id,
          },
          tenantId,
        );
      }
    }

    return atualizado;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.agendamento.delete({ where: { id } });
  }

  /** Agendamentos cujo horário já passou e ainda não tiveram ação */
  async findPendentes(tenantId: string) {
    return this.prisma.agendamento.findMany({
      where: {
        tenantId,
        dataHora: { lt: new Date() },
        status: { in: ['Agendado', 'Confirmado'] },
      },
      orderBy: { dataHora: 'asc' },
      include: this.include,
    });
  }

  /** Marca como NaoCompareceu todos os agendamentos passados sem ação (chamado pelo cron global) */
  async marcarNaoCompareceu() {
    return this.prisma.agendamento.updateMany({
      where: {
        dataHora: { lt: new Date() },
        status: { in: ['Agendado', 'Confirmado'] },
      },
      data: { status: 'NaoCompareceu' },
    });
  }
}
