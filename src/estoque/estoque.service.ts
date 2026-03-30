import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProdutoDto } from './dto/create-produto.dto';
import { UpdateProdutoDto } from './dto/update-produto.dto';
import { CreateMovimentacaoDto } from './dto/create-movimentacao.dto';

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
        ? produto.quantidadeAtual + dto.quantidade
        : produto.quantidadeAtual - dto.quantidade;

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
}
