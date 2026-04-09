import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import {
  TipoItemVenda,
  TipoLancamento,
  CategoriaLancamento,
} from '@prisma/client';

@Injectable()
export class PdvService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Buscar próximo número de venda ────────────────────────

  private async proximoNumero(tenantId: string): Promise<number> {
    const ultima = await this.prisma.venda.findFirst({
      where: { tenantId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    return (ultima?.numero ?? 0) + 1;
  }

  // ─── Fechar venda ──────────────────────────────────────────

  async fecharVenda(tenantId: string, dto: CreateVendaDto) {
    const numero = await this.proximoNumero(tenantId);

    // Calcular subtotais e total
    const itensComSubtotal = dto.itens.map((item) => ({
      ...item,
      subtotal: item.quantidade * item.precoUnitario,
    }));

    const subtotalBruto = itensComSubtotal.reduce(
      (acc, i) => acc + i.subtotal,
      0,
    );
    const desconto = dto.desconto ?? 0;
    const valorTotal = Math.max(0, subtotalBruto - desconto);
    const troco =
      dto.valorPago != null && dto.valorPago > valorTotal
        ? dto.valorPago - valorTotal
        : null;

    // Validar que produtos com estoque existem e têm quantidade suficiente
    const produtoIds = dto.itens
      .filter((i) => i.tipo === TipoItemVenda.Produto && i.produtoId)
      .map((i) => i.produtoId!);

    if (produtoIds.length > 0) {
      const produtos = await this.prisma.produto.findMany({
        where: { tenantId, id: { in: produtoIds } },
        select: { id: true, nome: true, quantidadeAtual: true },
      });

      for (const item of dto.itens.filter(
        (i) => i.tipo === TipoItemVenda.Produto && i.produtoId,
      )) {
        const prod = produtos.find((p) => p.id === item.produtoId);
        if (!prod)
          throw new NotFoundException(`Produto "${item.nome}" não encontrado`);
        if (prod.quantidadeAtual < item.quantidade) {
          throw new BadRequestException(
            `Estoque insuficiente para "${prod.nome}": disponível ${prod.quantidadeAtual}, solicitado ${item.quantidade}`,
          );
        }
      }
    }

    // Transação: criar venda + baixar estoque + lançamento financeiro
    return this.prisma.$transaction(async (tx) => {
      // 1) Criar a venda
      const venda = await tx.venda.create({
        data: {
          numero,
          tenantId,
          formaPagamento: dto.formaPagamento,
          valorTotal,
          desconto: desconto > 0 ? desconto : null,
          valorPago: dto.valorPago ?? null,
          troco,
          observacoes: dto.observacoes ?? null,
          clienteId: dto.clienteId ?? null,
          itens: {
            create: itensComSubtotal.map((i) => ({
              tipo: i.tipo,
              nome: i.nome,
              quantidade: i.quantidade,
              precoUnitario: i.precoUnitario,
              subtotal: i.subtotal,
              produtoId: i.produtoId ?? null,
              servicoId: i.servicoId ?? null,
              tenantId,
            })),
          },
        },
        include: {
          itens: true,
          cliente: { select: { id: true, nome: true } },
        },
      });

      // 2) Baixar estoque dos produtos vendidos
      for (const item of dto.itens.filter(
        (i) => i.tipo === TipoItemVenda.Produto && i.produtoId,
      )) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: { quantidadeAtual: { decrement: item.quantidade } },
        });

        await tx.movimentacao.create({
          data: {
            tipo: 'Saida',
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            motivo: 'Venda PDV',
            observacoes: `Venda #${numero}`,
            produtoId: item.produtoId!,
            tenantId,
          },
        });
      }

      // 3) Registrar receita no financeiro
      await tx.lancamento.create({
        data: {
          tipo: TipoLancamento.Receita,
          valor: valorTotal,
          descricao: `Venda PDV #${numero}`,
          categoria: CategoriaLancamento.Produto,
          tenantId,
        },
      });

      return venda;
    });
  }

  // ─── Listar vendas ──────────────────────────────────────────

  async listar(
    tenantId: string,
    params: { dataInicio?: string; dataFim?: string; page?: number },
  ) {
    const where: Record<string, unknown> = { tenantId };

    if (params.dataInicio || params.dataFim) {
      where['createdAt'] = {
        ...(params.dataInicio && {
          gte: new Date(`${params.dataInicio}T00:00:00.000Z`),
        }),
        ...(params.dataFim && {
          lte: new Date(`${params.dataFim}T23:59:59.999Z`),
        }),
      };
    }

    const take = 20;
    const skip = ((params.page ?? 1) - 1) * take;

    const [vendas, total] = await Promise.all([
      this.prisma.venda.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          itens: true,
          cliente: { select: { id: true, nome: true } },
        },
      }),
      this.prisma.venda.count({ where }),
    ]);

    return { vendas, total, page: params.page ?? 1, take };
  }

  // ─── Buscar venda por id ─────────────────────────────────────

  async findOne(tenantId: string, id: string) {
    const venda = await this.prisma.venda.findFirst({
      where: { id, tenantId },
      include: {
        itens: true,
        cliente: { select: { id: true, nome: true } },
      },
    });
    if (!venda) throw new NotFoundException('Venda não encontrada');
    return venda;
  }

  // ─── Cancelar venda ──────────────────────────────────────────

  async cancelar(tenantId: string, id: string) {
    const venda = await this.findOne(tenantId, id);
    if (venda.status === 'Cancelada') {
      throw new BadRequestException('Venda já está cancelada');
    }

    return this.prisma.$transaction(async (tx) => {
      // Estornar estoque dos produtos
      for (const item of venda.itens.filter(
        (i) => i.tipo === TipoItemVenda.Produto && i.produtoId,
      )) {
        await tx.produto.update({
          where: { id: item.produtoId as string },
          data: { quantidadeAtual: { increment: item.quantidade } },
        });

        await tx.movimentacao.create({
          data: {
            tipo: 'Entrada',
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            motivo: 'Cancelamento PDV',
            observacoes: `Venda #${venda.numero} cancelada`,
            produtoId: item.produtoId as string,
            tenantId,
          },
        });
      }

      // Lançamento de estorno financeiro
      await tx.lancamento.create({
        data: {
          tipo: TipoLancamento.Despesa,
          valor: venda.valorTotal,
          descricao: `Estorno PDV #${venda.numero}`,
          categoria: CategoriaLancamento.Produto,
          tenantId,
        },
      });

      return tx.venda.update({
        where: { id },
        data: { status: 'Cancelada' },
        include: { itens: true, cliente: { select: { id: true, nome: true } } },
      });
    });
  }

  // ─── Resumo do dia ───────────────────────────────────────────

  async resumoDia(tenantId: string, data?: string) {
    const dia = data ?? new Date().toISOString().split('T')[0];
    const inicio = new Date(`${dia}T00:00:00.000Z`);
    const fim = new Date(`${dia}T23:59:59.999Z`);

    const vendas = await this.prisma.venda.findMany({
      where: {
        tenantId,
        status: 'Concluida',
        createdAt: { gte: inicio, lte: fim },
      },
      select: { valorTotal: true, formaPagamento: true },
    });

    const totalVendas = vendas.reduce(
      (acc, v) => acc + Number(v.valorTotal),
      0,
    );

    const porFormaPagamento = vendas.reduce(
      (acc, v) => {
        acc[v.formaPagamento] =
          (acc[v.formaPagamento] ?? 0) + Number(v.valorTotal);
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      totalVendas,
      quantidadeVendas: vendas.length,
      porFormaPagamento,
      data: dia,
    };
  }
}
