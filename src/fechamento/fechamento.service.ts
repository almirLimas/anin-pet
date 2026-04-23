import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FecharCaixaDto } from './dto/fechar-caixa.dto';

@Injectable()
export class FechamentoService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Fechar o caixa do dia ──────────────────────────────────────────────────

  async fechar(
    tenantId: string,
    usuarioId: string,
    dto: FecharCaixaDto,
    data?: string,
  ) {
    const dia =
      data ??
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    // Verifica se já existe fechamento para este dia
    const jaFechado = await this.prisma.fechamentoCaixa.findUnique({
      where: {
        tenantId_data: { tenantId, data: new Date(dia + 'T12:00:00Z') },
      },
    });
    if (jaFechado) {
      throw new BadRequestException(
        `O caixa do dia ${dia} já foi fechado anteriormente.`,
      );
    }

    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(`${dia}T23:59:59.999-03:00`);

    // ─── PDV ────────────────────────────────────────────────────────────────
    const vendas = await this.prisma.venda.findMany({
      where: {
        tenantId,
        status: 'Concluida',
        createdAt: { gte: inicio, lte: fim },
      },
      select: { valorTotal: true, formaPagamento: true },
    });

    const totalPdv = vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0);
    const porFormaPdv = vendas.reduce(
      (acc, v) => {
        acc[v.formaPagamento] =
          (acc[v.formaPagamento] ?? 0) + Number(v.valorTotal);
        return acc;
      },
      {} as Record<string, number>,
    );

    // ─── Agendamentos (lançamentos de receita vinculados a agendamentos) ────────
    const lancamentosAgendamentos = await this.prisma.lancamento.findMany({
      where: {
        tenantId,
        tipo: 'Receita',
        categoria: 'Servico',
        agendamentoId: { not: null },
        data: { gte: inicio, lte: fim },
      },
      select: { valor: true, formaPagamento: true },
    });

    const totalAgendamentos = lancamentosAgendamentos.reduce(
      (acc, l) => acc + Number(l.valor),
      0,
    );
    const porFormaAgendamentos = lancamentosAgendamentos.reduce(
      (acc, l) => {
        const forma = l.formaPagamento ?? 'Outro';
        acc[forma] = (acc[forma] ?? 0) + Number(l.valor);
        return acc;
      },
      {} as Record<string, number>,
    );
    const qtdAgendamentos = lancamentosAgendamentos.length;

    // ─── Totais combinados ────────────────────────────────────────────────────
    const totalGeral = totalPdv + totalAgendamentos;
    const porFormaCombinada: Record<string, number> = { ...porFormaPdv };
    for (const [forma, valor] of Object.entries(porFormaAgendamentos)) {
      porFormaCombinada[forma] = (porFormaCombinada[forma] ?? 0) + valor;
    }

    return this.prisma.fechamentoCaixa.create({
      data: {
        data: new Date(dia + 'T12:00:00Z'),
        totalVendas: totalGeral,
        quantidadeVendas: vendas.length + qtdAgendamentos,
        porFormaPagamento: porFormaCombinada,
        totalPdv,
        qtdPdv: vendas.length,
        porFormaPdv,
        totalAgendamentos,
        qtdAgendamentos,
        porFormaAgendamentos,
        observacoes: dto.observacoes,
        usuarioId,
        tenantId,
      },
      include: { usuario: { select: { nomeCompleto: true } } },
    });
  }

  // ─── Resumo do dia (live) ─────────────────────────────────────────────────

  async resumoDia(tenantId: string, data?: string) {
    const dia =
      data ??
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(`${dia}T23:59:59.999-03:00`);

    const [vendas, lancamentosAgendamentos] = await Promise.all([
      this.prisma.venda.findMany({
        where: {
          tenantId,
          status: 'Concluida',
          createdAt: { gte: inicio, lte: fim },
        },
        select: { valorTotal: true, formaPagamento: true },
      }),
      this.prisma.lancamento.findMany({
        where: {
          tenantId,
          tipo: 'Receita',
          categoria: 'Servico',
          agendamentoId: { not: null },
          data: { gte: inicio, lte: fim },
        },
        select: { valor: true, formaPagamento: true },
      }),
    ]);

    const totalPdv = vendas.reduce((acc, v) => acc + Number(v.valorTotal), 0);
    const porFormaPdv = vendas.reduce(
      (acc, v) => {
        acc[v.formaPagamento] =
          (acc[v.formaPagamento] ?? 0) + Number(v.valorTotal);
        return acc;
      },
      {} as Record<string, number>,
    );

    const totalAgendamentos = lancamentosAgendamentos.reduce(
      (acc, l) => acc + Number(l.valor),
      0,
    );
    const porFormaAgendamentos = lancamentosAgendamentos.reduce(
      (acc, l) => {
        const forma = l.formaPagamento ?? 'Outro';
        acc[forma] = (acc[forma] ?? 0) + Number(l.valor);
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      data: dia,
      pdv: {
        total: totalPdv,
        quantidade: vendas.length,
        porFormaPagamento: porFormaPdv,
      },
      agendamentos: {
        total: totalAgendamentos,
        quantidade: lancamentosAgendamentos.length,
        porFormaPagamento: porFormaAgendamentos,
      },
      totalGeral: totalPdv + totalAgendamentos,
      quantidadeTotal: vendas.length + lancamentosAgendamentos.length,
    };
  }

  // ─── Listar fechamentos ─────────────────────────────────────────────────────

  async listar(tenantId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.fechamentoCaixa.findMany({
        where: { tenantId },
        orderBy: { data: 'desc' },
        skip,
        take: limit,
        include: { usuario: { select: { nomeCompleto: true } } },
      }),
      this.prisma.fechamentoCaixa.count({ where: { tenantId } }),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // ─── Detalhe de um fechamento ───────────────────────────────────────────────

  async buscarUm(tenantId: string, id: string) {
    const fechamento = await this.prisma.fechamentoCaixa.findFirst({
      where: { id, tenantId },
      include: { usuario: { select: { nomeCompleto: true } } },
    });
    if (!fechamento) throw new NotFoundException('Fechamento não encontrado.');
    return fechamento;
  }

  // ─── Verificar se o dia atual já foi fechado ────────────────────────────────

  async statusDia(tenantId: string, data?: string) {
    const dia =
      data ??
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const fechamento = await this.prisma.fechamentoCaixa.findUnique({
      where: {
        tenantId_data: { tenantId, data: new Date(dia + 'T12:00:00Z') },
      },
      select: {
        id: true,
        criadoEm: true,
        totalVendas: true,
        quantidadeVendas: true,
        porFormaPagamento: true,
        totalPdv: true,
        qtdPdv: true,
        porFormaPdv: true,
        totalAgendamentos: true,
        qtdAgendamentos: true,
        porFormaAgendamentos: true,
        observacoes: true,
        usuario: { select: { nomeCompleto: true } },
      },
    });
    return { fechado: !!fechamento, fechamento };
  }
}
