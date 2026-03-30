import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLancamentoDto } from './dto/create-lancamento.dto';
import { TipoLancamento } from '@prisma/client';

@Injectable()
export class FinanceiroService {
  constructor(private readonly prisma: PrismaService) {}

  listar(
    tenantId: string,
    params: {
      dataInicio?: string;
      dataFim?: string;
      tipo?: TipoLancamento;
    },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (params.dataInicio || params.dataFim) {
      where['data'] = {
        ...(params.dataInicio && {
          gte: new Date(`${params.dataInicio}T00:00:00.000Z`),
        }),
        ...(params.dataFim && {
          lte: new Date(`${params.dataFim}T23:59:59.999Z`),
        }),
      };
    }

    if (params.tipo) {
      where['tipo'] = params.tipo;
    }

    return this.prisma.lancamento.findMany({
      where,
      orderBy: { data: 'desc' },
      include: {
        agendamento: {
          select: {
            id: true,
            pet: { select: { nome: true } },
            servico: { select: { nome: true } },
          },
        },
      },
    });
  }

  async resumoMes(tenantId: string, ano: number, mes: number) {
    const inicio = new Date(
      `${ano}-${String(mes).padStart(2, '0')}-01T00:00:00.000Z`,
    );
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const fim = new Date(
      `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}T23:59:59.999Z`,
    );

    const lancamentos = await this.prisma.lancamento.findMany({
      where: { tenantId, data: { gte: inicio, lte: fim } },
      select: { tipo: true, valor: true },
    });

    const receitas = lancamentos
      .filter((l) => l.tipo === 'Receita')
      .reduce((sum: number, l) => sum + Number(l.valor), 0);

    const despesas = lancamentos
      .filter((l) => l.tipo === 'Despesa')
      .reduce((sum: number, l) => sum + Number(l.valor), 0);

    return {
      receitas,
      despesas,
      saldo: receitas - despesas,
      total: lancamentos.length,
    };
  }

  criar(dto: CreateLancamentoDto, tenantId: string) {
    return this.prisma.lancamento.create({
      data: {
        tipo: dto.tipo,
        valor: dto.valor,
        descricao: dto.descricao,
        categoria: dto.categoria ?? 'Outro',
        data: dto.data ? new Date(`${dto.data}T12:00:00.000Z`) : new Date(),
        agendamentoId: dto.agendamentoId ?? null,
        tenantId,
      },
    });
  }

  async buscarUm(tenantId: string, id: string) {
    const lancamento = await this.prisma.lancamento.findFirst({
      where: { id, tenantId },
    });
    if (!lancamento) throw new NotFoundException('Lançamento não encontrado');
    return lancamento;
  }

  async atualizar(
    tenantId: string,
    id: string,
    dto: Partial<CreateLancamentoDto>,
  ) {
    await this.buscarUm(tenantId, id);
    return this.prisma.lancamento.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.valor !== undefined && { valor: dto.valor }),
        ...(dto.data && { data: new Date(dto.data) }),
      },
    });
  }

  async remover(tenantId: string, id: string) {
    await this.buscarUm(tenantId, id);
    return this.prisma.lancamento.delete({ where: { id } });
  }
}
