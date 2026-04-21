import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { CreateAgendamentoRecorrenteDto } from './dto/create-agendamento-recorrente.dto';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AvaliacoesService } from '../avaliacoes/avaliacoes.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
    private readonly whatsapp: WhatsappService,
    private readonly avaliacoes: AvaliacoesService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private get include() {
    return {
      cliente: {
        select: {
          id: true,
          nome: true,
          telefonePrincipal: true,
          mensalista: true,
        },
      },
      pet: { select: { id: true, nome: true, especie: true } },
      servicos: {
        include: {
          servico: {
            select: { id: true, nome: true, preco: true, duracaoMinutos: true },
          },
        },
      },
      ordemServico: { select: { id: true, status: true } },
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
    const { servicoIds, taxaBusca, dataHora, ...rest } = dto;
    const agendamento = await this.prisma.agendamento.create({
      data: {
        ...rest,
        tenantId,
        dataHora: new Date(dataHora),
        ...(taxaBusca !== undefined && { taxaBusca }),
        servicos: {
          create: servicoIds.map((sid) => ({ servicoId: sid })),
        },
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
      const nomesServicos = agendamento.servicos
        .map((s) => s.servico.nome)
        .join(', ');
      const mensagem =
        `Olá, ${agendamento.cliente.nome}! 🐾 Seu agendamento foi confirmado.\n` +
        `Pet: ${agendamento.pet.nome}\n` +
        `Serviço: ${nomesServicos}\n` +
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

  async criarRecorrente(tenantId: string, dto: CreateAgendamentoRecorrenteDto) {
    const recorrenciaId = createId();
    const semanas = dto.quantidadeSemanas ?? 4;

    // Calcula a primeira ocorrência do dia da semana a partir de dataInicio
    const base = dto.dataInicio
      ? new Date(`${dto.dataInicio}T00:00:00`)
      : new Date();
    const diff = (dto.diaDaSemana - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);

    const [hora, minuto] = dto.hora.split(':').map(Number);

    const agendamentos = await Promise.all(
      Array.from({ length: semanas }, (_, i) => {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + i * 7);
        dt.setHours(hora, minuto, 0, 0);
        return this.prisma.agendamento.create({
          data: {
            recorrenciaId,
            dataHora: dt,
            clienteId: dto.clienteId,
            petId: dto.petId,
            tenantId,
            modalidade: dto.modalidade ?? 'ClienteTraz',
            ...(dto.taxaBusca !== undefined && { taxaBusca: dto.taxaBusca }),
            ...(dto.enderecoBusca && { enderecoBusca: dto.enderecoBusca }),
            ...(dto.observacoes && { observacoes: dto.observacoes }),
            servicos: {
              create: dto.servicoIds.map((sid) => ({ servicoId: sid })),
            },
          },
          include: this.include,
        });
      }),
    );

    return agendamentos;
  }

  async update(tenantId: string, id: string, dto: UpdateAgendamentoDto) {
    await this.findOne(tenantId, id);
    const { servicoIds, ...restDto } = dto;

    // Monta explicitamente apenas os campos que foram enviados na requisição
    const data: Prisma.AgendamentoUncheckedUpdateInput = {};
    if (restDto.status !== undefined) data.status = restDto.status;
    if (restDto.dataHora !== undefined)
      data.dataHora = new Date(restDto.dataHora);
    if (restDto.modalidade !== undefined) data.modalidade = restDto.modalidade;
    if (restDto.taxaBusca !== undefined) data.taxaBusca = restDto.taxaBusca;
    if (restDto.enderecoBusca !== undefined)
      data.enderecoBusca = restDto.enderecoBusca?.trim() || null;
    if (restDto.observacoes !== undefined)
      data.observacoes = restDto.observacoes?.trim() || null;
    if (servicoIds !== undefined)
      data.servicos = {
        deleteMany: {},
        create: servicoIds.map((sid) => ({ servicoId: sid })),
      };

    const atualizado = await this.prisma.agendamento.update({
      where: { id },
      data,
      include: this.include,
    });

    // Cancela lançamento financeiro se o agendamento for cancelado
    if (dto.status === 'Cancelado') {
      await this.prisma.lancamento.deleteMany({
        where: { agendamentoId: id },
      });
    }

    // Auto-lançamento financeiro ao concluir
    if (dto.status === 'Concluido') {
      const jaExiste = await this.prisma.lancamento.findFirst({
        where: { agendamentoId: id },
      });
      if (!jaExiste) {
        const taxaBusca = atualizado.taxaBusca
          ? Number(atualizado.taxaBusca)
          : 0;
        const totalServicos = atualizado.servicos.reduce(
          (sum, as) => sum + Number(as.servico.preco),
          0,
        );
        const valorTotal = totalServicos + taxaBusca;
        const nomesServicos = atualizado.servicos
          .map((as) => as.servico.nome)
          .join(', ');
        const descricao =
          taxaBusca > 0
            ? `${nomesServicos} — ${atualizado.pet.nome} (+ taxa de busca)`
            : `${nomesServicos} — ${atualizado.pet.nome}`;

        await this.financeiro.criar(
          {
            tipo: 'Receita',
            valor: valorTotal,
            descricao,
            categoria: 'Servico',
            agendamentoId: id,
            formaPagamento: restDto.formaPagamento ?? undefined,
          },
          tenantId,
        );
      }

      // Dispara pesquisa de satisfação por e-mail (se cliente tiver e-mail)
      const clienteCompleto = await this.prisma.cliente.findUnique({
        where: { id: atualizado.cliente.id },
        select: { email: true },
      });

      this.logger.log(
        `[Satisfação] Agendamento ${id} concluído — e-mail do cliente: ${clienteCompleto?.email ?? 'NÃO CADASTRADO'}`,
      );

      if (clienteCompleto?.email) {
        const jaTemAvaliacao = await this.prisma.avaliacaoCliente.findUnique({
          where: { agendamentoId: id },
        });

        if (jaTemAvaliacao) {
          this.logger.log(
            `[Satisfação] Avaliação já existe para agendamento ${id}, pulando envio.`,
          );
        } else {
          const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { nome: true },
          });
          const token = await this.avaliacoes.criarPendente(
            id,
            atualizado.cliente.id,
            tenantId,
          );
          const baseUrl = this.config
            .get<string>('FRONTEND_URL', 'https://app.aninpet.com.br')
            .split(',')[0]
            .trim()
            .replace(/\/$/, '');
          const linkAvaliacao = `${baseUrl}/avaliar/${token}`;
          this.logger.log(
            `[Satisfação] Enviando e-mail para ${clienteCompleto.email} — link: ${linkAvaliacao}`,
          );
          this.email
            .enviarPesquisaSatisfacao(
              clienteCompleto.email,
              atualizado.cliente.nome,
              atualizado.pet.nome,
              atualizado.servicos[0]?.servico.nome ?? 'Serviço',
              tenant?.nome ?? 'Petshop',
              linkAvaliacao,
            )
            .catch((err: unknown) =>
              this.logger.error(
                `[Satisfação] Falha ao enviar e-mail para ${clienteCompleto.email}: ${String(err)}`,
              ),
            );
        }
      }

      // Alerta interno para o admin
      const tenant = await this.prisma.tenant
        .findUnique({
          where: { id: tenantId },
          select: { nome: true },
        })
        .catch(() => null);
      const totalServicos = atualizado.servicos.reduce(
        (sum, as) => sum + Number(as.servico.preco),
        0,
      );
      const taxaBusca = atualizado.taxaBusca ? Number(atualizado.taxaBusca) : 0;
      this.email
        .enviarAlertaAgendamentoConcluido({
          nomePetshop: tenant?.nome ?? tenantId,
          tenantId,
          nomeCliente: atualizado.cliente.nome,
          nomePet: atualizado.pet.nome,
          servicos: atualizado.servicos.map((as) => as.servico.nome).join(', '),
          formaPagamento: restDto.formaPagamento ?? null,
          valor: totalServicos + taxaBusca,
        })
        .catch((err: unknown) =>
          this.logger.error(
            '[Admin] Falha ao enviar alerta de agendamento',
            String(err),
          ),
        );
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
