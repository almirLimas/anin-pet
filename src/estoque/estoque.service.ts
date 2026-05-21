import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { parseStringPromise } from 'xml2js';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { CreateMovimentacaoDto } from './dto/create-movimentacao.dto';
import { CreateEntradaMercadoriaDto } from './dto/create-entrada-mercadoria.dto';

export interface NfeItemPreview {
  nomeNfe: string;
  eanNfe: string;
  codigoProdutoNfe: string;
  quantidade: number;
  precoUnitario: number;
  produtoId: string | null;
  produtoNome: string | null;
}

@Injectable()
export class EstoqueService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Produtos ───────────────────────────────────────────────

  async findAllProdutos(tenantId: string, busca?: string, alertas = false) {
    const produtos = await this.prisma.produto.findMany({
      where: busca
        ? {
            tenantId,
            OR: [
              { nome: { contains: busca, mode: 'insensitive' as const } },
              { codigoBarras: { contains: busca } },
            ],
          }
        : { tenantId },
      orderBy: { nome: 'asc' },
    });

    if (alertas)
      return produtos.filter((p) => p.quantidadeAtual <= p.estoqueMinimo);
    return produtos;
  }

  async findOneProduto(tenantId: string, id: string) {
    const produto = await this.prisma.produto.findFirst({
      where: { id, tenantId },
    });
    if (!produto) throw new NotFoundException('Produto não encontrado');
    return produto;
  }

  async createProduto(tenantId: string, dto: CreateProdutoDto) {
    return this.prisma.produto.create({ data: { ...dto, tenantId } });
  }

  async updateProduto(tenantId: string, id: string, dto: UpdateProdutoDto) {
    await this.findOneProduto(tenantId, id);
    return this.prisma.produto.update({ where: { id }, data: dto });
  }

  async removeProduto(tenantId: string, id: string) {
    await this.findOneProduto(tenantId, id);
    return this.prisma.produto.delete({ where: { id } });
  }

  // ─── Movimentações ──────────────────────────────────────────

  async findAllMovimentacoes(tenantId: string, produtoId?: string) {
    return this.prisma.movimentacao.findMany({
      where: produtoId ? { tenantId, produtoId } : { tenantId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { produto: { select: { id: true, nome: true, unidade: true } } },
    });
  }

  async createMovimentacao(
    tenantId: string,
    dto: CreateMovimentacaoDto,
    usuarioId: string,
  ) {
    const produto = await this.findOneProduto(tenantId, dto.produtoId);

    const novaQuantidade =
      dto.tipo === 'Entrada'
        ? Number(produto.quantidadeAtual) + dto.quantidade
        : Number(produto.quantidadeAtual) - dto.quantidade;

    if (novaQuantidade < 0) {
      throw new BadRequestException('Quantidade insuficiente em estoque');
    }

    const [movimentacao] = await this.prisma.$transaction([
      this.prisma.movimentacao.create({
        data: { ...dto, usuarioId, tenantId },
        include: {
          produto: { select: { id: true, nome: true, unidade: true } },
        },
      }),
      this.prisma.produto.update({
        where: { id: dto.produtoId },
        data: { quantidadeAtual: novaQuantidade },
      }),
    ]);

    return movimentacao;
  }

  // ─── Alertas de estoque mínimo ──────────────────────────────

  async findAlertasEstoque(tenantId: string) {
    // Retorna produtos onde quantidadeAtual <= estoqueMinimo (e estoqueMinimo > 0)
    return this.prisma.$queryRaw<
      Array<{
        id: string;
        nome: string;
        quantidadeAtual: number;
        estoqueMinimo: number;
        unidade: string | null;
        categoria: string;
      }>
    >`
      SELECT id, nome, "quantidadeAtual"::float, "estoqueMinimo"::float, unidade, categoria
      FROM "Produto"
      WHERE "tenantId" = ${tenantId}
        AND ativo = true
        AND "estoqueMinimo" > 0
        AND "quantidadeAtual" <= "estoqueMinimo"
      ORDER BY nome ASC
    `;
  }

  // ─── Entradas de Mercadoria ─────────────────────────────────

  private async proximoNumeroEntrada(tenantId: string): Promise<number> {
    const ultima = await this.prisma.entradaMercadoria.findFirst({
      where: { tenantId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    return (ultima?.numero ?? 0) + 1;
  }

  async findAllEntradas(tenantId: string) {
    return this.prisma.entradaMercadoria.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        fornecedor: { select: { id: true, nome: true } },
        itens: {
          include: {
            produto: { select: { id: true, nome: true, unidade: true } },
          },
        },
      },
    });
  }

  async findOneEntrada(tenantId: string, id: string) {
    const entrada = await this.prisma.entradaMercadoria.findFirst({
      where: { id, tenantId },
      include: {
        fornecedor: { select: { id: true, nome: true } },
        itens: {
          include: {
            produto: { select: { id: true, nome: true, unidade: true } },
          },
        },
      },
    });
    if (!entrada) throw new NotFoundException('Entrada não encontrada');
    return entrada;
  }

  async criarEntrada(
    tenantId: string,
    usuarioId: string,
    dto: CreateEntradaMercadoriaDto,
  ) {
    const numero = await this.proximoNumeroEntrada(tenantId);

    // Validar que todos os produtos existem no tenant
    const produtoIds = dto.itens.map((i) => i.produtoId);
    const produtos = await this.prisma.produto.findMany({
      where: { tenantId, id: { in: produtoIds } },
      select: { id: true, nome: true },
    });
    if (produtos.length !== produtoIds.length) {
      throw new NotFoundException('Um ou mais produtos não encontrados');
    }

    return this.prisma.$transaction(async (tx) => {
      const entrada = await tx.entradaMercadoria.create({
        data: {
          numero,
          tenantId,
          fornecedorId: dto.fornecedorId ?? null,
          observacoes: dto.observacoes ?? null,
          status: 'Confirmada',
          itens: {
            create: dto.itens.map((item) => ({
              produtoId: item.produtoId,
              quantidade: item.quantidade,
              precoUnitario: item.precoUnitario,
              subtotal: item.quantidade * item.precoUnitario,
              tenantId,
            })),
          },
        },
        include: {
          fornecedor: { select: { id: true, nome: true } },
          itens: {
            include: {
              produto: { select: { id: true, nome: true, unidade: true } },
            },
          },
        },
      });

      // Dar entrada no estoque e atualizar preço de compra de cada produto
      for (const item of dto.itens) {
        await tx.produto.update({
          where: { id: item.produtoId },
          data: {
            quantidadeAtual: { increment: item.quantidade },
            precoCompra: item.precoUnitario,
          },
        });

        await tx.movimentacao.create({
          data: {
            tipo: 'Entrada',
            quantidade: item.quantidade,
            precoUnitario: item.precoUnitario,
            motivo: 'Entrada de mercadoria',
            observacoes: `Entrada #${numero}`,
            produtoId: item.produtoId,
            fornecedorId: dto.fornecedorId ?? null,
            entradaMercadoriaId: entrada.id,
            usuarioId,
            tenantId,
          },
        });
      }

      return entrada;
    });
  }

  // ─── Parse NF-e XML ─────────────────────────────────────────

  async parseNfeXml(
    tenantId: string,
    xml: string,
  ): Promise<{ emitente: string; itens: NfeItemPreview[] }> {
    let parsed: Record<string, unknown>;
    try {
      parsed = await parseStringPromise(xml, {
        explicitArray: false,
        ignoreAttrs: false,
        tagNameProcessors: [(name) => name.replace(/^.*:/, '')],
      });
    } catch {
      throw new BadRequestException('XML inválido ou corrompido');
    }

    // Suporta nfeProc > NFe e NFe direto
    const nfeProc = parsed['nfeProc'] as Record<string, unknown> | undefined;
    const nfe = (nfeProc?.['NFe'] ?? parsed['NFe']) as
      | Record<string, unknown>
      | undefined;
    if (!nfe) throw new BadRequestException('Arquivo não é uma NF-e válida');

    const infNFe = nfe['infNFe'] as Record<string, unknown>;
    if (!infNFe) throw new BadRequestException('NF-e sem infNFe');

    const emit = infNFe['emit'] as Record<string, unknown>;
    const xNome = emit?.['xNome'];
    const emitente =
      typeof xNome === 'string' ? xNome : 'Fornecedor desconhecido';

    const detRaw = infNFe['det'];
    const dets: Record<string, unknown>[] = Array.isArray(detRaw)
      ? (detRaw as Record<string, unknown>[])
      : [detRaw as Record<string, unknown>];

    // Busca todos os produtos do tenant para tentar vincular por EAN ou código
    const produtosTenant = await this.prisma.produto.findMany({
      where: { tenantId, ativo: true },
      select: { id: true, nome: true, codigoBarras: true },
    });

    const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');

    const itens: NfeItemPreview[] = dets
      .filter((d) => d?.['prod'])
      .map((d) => {
        const prod = d['prod'] as Record<string, unknown>;
        const nomeNfe = toStr(prod['xProd']);
        const eanNfe = toStr(prod['cEAN']).replace(/\D/g, '');
        const codigoProdutoNfe = toStr(prod['cProd']);
        const quantidade = Number(prod['qCom'] ?? 0);
        const precoUnitario = Number(prod['vUnCom'] ?? 0);

        // Tenta vincular: 1) por EAN, 2) por código de produto
        const vinculado =
          (eanNfe
            ? produtosTenant.find(
                (p) => p.codigoBarras && p.codigoBarras === eanNfe,
              )
            : null) ??
          produtosTenant.find(
            (p) => p.codigoBarras && p.codigoBarras === codigoProdutoNfe,
          ) ??
          null;

        return {
          nomeNfe,
          eanNfe,
          codigoProdutoNfe,
          quantidade,
          precoUnitario,
          produtoId: vinculado?.id ?? null,
          produtoNome: vinculado?.nome ?? null,
        };
      });

    return { emitente, itens };
  }
}
