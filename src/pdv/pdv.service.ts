import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { CreateVendaDto } from './dto/create-venda.dto';
import {
  TipoItemVenda,
  TipoLancamento,
  CategoriaLancamento,
} from '@prisma/client';

@Injectable()
export class PdvService {
  private readonly logger = new Logger(PdvService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

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

    // Validar e aplicar cupom (se informado)
    let cupomId: string | null = null;
    let cupomCodigo: string | null = null;
    let cupomDesconto = 0;

    if (dto.cupomCodigo) {
      const cupom = await this.prisma.cupom.findUnique({
        where: {
          tenantId_codigo: { tenantId, codigo: dto.cupomCodigo.toUpperCase() },
        },
      });
      if (!cupom || !cupom.ativo) {
        throw new BadRequestException('Cupom inválido ou inativo');
      }
      if (cupom.expiraEm && cupom.expiraEm < new Date()) {
        throw new BadRequestException('Cupom expirado');
      }
      if (cupom.usoMaximo !== null && cupom.usoAtual >= cupom.usoMaximo) {
        throw new BadRequestException('Cupom atingiu o limite de usos');
      }
      cupomId = cupom.id;
      cupomCodigo = cupom.codigo;
      cupomDesconto =
        cupom.tipo === 'Percentual'
          ? (subtotalBruto * Number(cupom.valor)) / 100
          : Math.min(Number(cupom.valor), subtotalBruto);
      cupomDesconto = Math.round(cupomDesconto * 100) / 100;
    }

    const desconto = (dto.desconto ?? 0) + cupomDesconto;
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
        if (Number(prod.quantidadeAtual) < item.quantidade) {
          throw new BadRequestException(
            `Estoque insuficiente para "${prod.nome}": disponível ${Number(prod.quantidadeAtual)}, solicitado ${item.quantidade}`,
          );
        }
      }
    }

    // Transação: criar venda + baixar estoque + lançamento financeiro
    const venda = await this.prisma.$transaction(async (tx) => {
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
          cupomId,
          cupomCodigo,
          cupomDesconto: cupomDesconto > 0 ? cupomDesconto : null,
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
      const nomesItens = itensComSubtotal
        .map((i) =>
          i.quantidade !== 1 ? `${i.nome} (×${i.quantidade})` : i.nome,
        )
        .join(', ');
      await tx.lancamento.create({
        data: {
          tipo: TipoLancamento.Receita,
          valor: valorTotal,
          descricao: `PDV #${numero} — ${nomesItens}`,
          categoria: CategoriaLancamento.Produto,
          formaPagamento: dto.formaPagamento ?? null,
          tenantId,
        },
      });

      // 4) Incrementar uso do cupom se aplicado
      if (cupomId) {
        await tx.cupom.update({
          where: { id: cupomId },
          data: { usoAtual: { increment: 1 } },
        });
      }

      return venda;
    });

    const nomesItensAlerta = itensComSubtotal
      .map((i) =>
        i.quantidade === 1 ? i.nome : `${i.nome} (×${i.quantidade})`,
      )
      .join(', ');
    void this.enviarAlertaVenda(
      tenantId,
      numero,
      nomesItensAlerta,
      valorTotal,
      dto.formaPagamento ?? null,
      venda.cliente?.nome ?? null,
    );

    return venda;
  }

  private async enviarAlertaVenda(
    tenantId: string,
    numeroPedido: number,
    itens: string,
    valor: number,
    formaPagamento: string | null | undefined,
    nomeCliente: string | null | undefined,
  ) {
    const tenant = await this.prisma.tenant
      .findUnique({ where: { id: tenantId }, select: { nome: true } })
      .catch(() => null);
    this.email
      .enviarAlertaVendaPdv({
        nomePetshop: tenant?.nome ?? tenantId,
        tenantId,
        numeroPedido,
        itens,
        formaPagamento: formaPagamento ?? null,
        valor,
        nomeCliente: nomeCliente ?? null,
      })
      .catch((err: unknown) =>
        this.logger.error(
          '[Admin] Falha ao enviar alerta de venda PDV',
          String(err),
        ),
      );
  }

  // ─── Buscar produto por código de barras (scan de etiqueta) ──

  // Configuração padrão: Toledo / Filizola (PLU 6 dígitos + preço 5 dígitos)
  private static readonly CONFIG_BALANCA_PADRAO = {
    prefixo: '2',
    posCodigo: 1,
    tamCodigo: 6,
    posValor: 7,
    tamValor: 5,
  };

  private resolverConfigBalanca(
    raw: unknown,
  ): typeof PdvService.CONFIG_BALANCA_PADRAO {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return PdvService.CONFIG_BALANCA_PADRAO;
    }
    const r = raw as Record<string, unknown>;
    return {
      prefixo:
        typeof r['prefixo'] === 'string'
          ? r['prefixo']
          : PdvService.CONFIG_BALANCA_PADRAO.prefixo,
      posCodigo:
        typeof r['posCodigo'] === 'number'
          ? r['posCodigo']
          : PdvService.CONFIG_BALANCA_PADRAO.posCodigo,
      tamCodigo:
        typeof r['tamCodigo'] === 'number'
          ? r['tamCodigo']
          : PdvService.CONFIG_BALANCA_PADRAO.tamCodigo,
      posValor:
        typeof r['posValor'] === 'number'
          ? r['posValor']
          : PdvService.CONFIG_BALANCA_PADRAO.posValor,
      tamValor:
        typeof r['tamValor'] === 'number'
          ? r['tamValor']
          : PdvService.CONFIG_BALANCA_PADRAO.tamValor,
    };
  }

  private parsearEtiquetaBalanca(
    codigo: string,
    cfg: typeof PdvService.CONFIG_BALANCA_PADRAO,
  ): {
    plu: string;
    precoBalanca: number | null;
    quantidadeKg: number | null;
  } | null {
    if (codigo.length !== 13 || !codigo.startsWith(cfg.prefixo)) return null;

    const plu = codigo.substring(cfg.posCodigo, cfg.posCodigo + cfg.tamCodigo);
    const valorStr = codigo.substring(
      cfg.posValor,
      cfg.posValor + cfg.tamValor,
    );
    const valor = Number.parseInt(valorStr, 10);
    if (Number.isNaN(valor) || valor === 0) return null;

    // Heurística: se o campo de valor parece peso (>= 5 dígitos com zeros no início)
    // usamos como peso em gramas; caso contrário, preço em centavos
    const esPeso = valorStr.startsWith('0') && valor < 10000;
    return esPeso
      ? { plu, precoBalanca: null, quantidadeKg: valor / 1000 }
      : { plu, precoBalanca: valor / 100, quantidadeKg: null };
  }

  async buscarPorBarcode(tenantId: string, codigo: string) {
    // 1. Tenta match exato no campo codigoBarras
    const produtoExato = await this.prisma.produto.findFirst({
      where: { tenantId, codigoBarras: codigo, ativo: true },
    });
    if (produtoExato) {
      return { ...produtoExato, quantidadeBalanca: null, precoBalanca: null };
    }

    // 2. Carrega config de balança do tenant e tenta interpretar como etiqueta
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { configuracaoBalanca: true },
    });
    const cfg = this.resolverConfigBalanca(tenant?.configuracaoBalanca);
    const balanca = this.parsearEtiquetaBalanca(codigo, cfg);

    if (balanca) {
      const produto = await this.prisma.produto.findFirst({
        where: { tenantId, codigoBarras: balanca.plu, ativo: true },
      });
      if (produto) {
        return {
          ...produto,
          quantidadeBalanca: balanca.quantidadeKg,
          precoBalanca: balanca.precoBalanca,
        };
      }
      throw new NotFoundException(
        `Etiqueta de balança detectada — PLU "${balanca.plu}" não está cadastrado. Abra o produto correto e salve o Código de Barras como "${balanca.plu}".`,
      );
    }

    throw new NotFoundException(
      `Código "${codigo}" não encontrado. Verifique se o produto está cadastrado com esse Código de Barras.`,
    );
  }

  // ─── Configuração de balança ────────────────────────────────

  async getConfiguracaoBalanca(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { configuracaoBalanca: true },
    });
    return this.resolverConfigBalanca(tenant?.configuracaoBalanca);
  }

  async salvarConfiguracaoBalanca(
    tenantId: string,
    cfg: {
      prefixo: string;
      posCodigo: number;
      tamCodigo: number;
      posValor: number;
      tamValor: number;
    },
  ) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { configuracaoBalanca: cfg },
    });
    return cfg;
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
    const dia =
      data ??
      new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const inicio = new Date(`${dia}T00:00:00-03:00`);
    const fim = new Date(`${dia}T23:59:59.999-03:00`);

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
