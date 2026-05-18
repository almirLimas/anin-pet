import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';

@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, apenasAtivos = false) {
    return this.prisma.servico.findMany({
      where: apenasAtivos ? { tenantId, ativo: true } : { tenantId },
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string) {
    const servico = await this.prisma.servico.findFirst({
      where: { id, tenantId },
    });
    if (!servico) throw new NotFoundException('Serviço não encontrado');
    return servico;
  }

  async create(tenantId: string, dto: CreateServicoDto) {
    return this.prisma.servico.create({ data: { ...dto, tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdateServicoDto) {
    await this.findOne(tenantId, id);
    const updated = await this.prisma.servico.update({
      where: { id },
      data: dto,
    });

    // Propaga nome/preço para itens de OS ainda abertas que referenciam este serviço
    if (dto.nome !== undefined || dto.preco !== undefined) {
      const itensAbertos = await this.prisma.itemOrdemServico.findMany({
        where: {
          servicoId: id,
          tenantId,
          ordemServico: { status: 'Aberta' },
        },
        select: { id: true, nome: true, quantidade: true },
      });

      await this.prisma.$transaction(
        itensAbertos.map((item) => {
          const ehMensalista = item.nome.includes('(Mensalista)');

          let novoNome: string | undefined;
          if (dto.nome !== undefined) {
            novoNome = ehMensalista ? `${dto.nome} (Mensalista)` : dto.nome;
          }

          const novoPreco =
            !ehMensalista && dto.preco !== undefined ? dto.preco : undefined;

          return this.prisma.itemOrdemServico.update({
            where: { id: item.id },
            data: {
              ...(novoNome !== undefined && { nome: novoNome }),
              ...(novoPreco !== undefined && {
                precoUnitario: novoPreco,
                subtotal: novoPreco * Number(item.quantidade),
              }),
            },
          });
        }),
      );
    }

    return updated;
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);

    const [agendamentos, itensVenda, itensOS] = await Promise.all([
      this.prisma.agendamentoServico.count({ where: { servicoId: id } }),
      this.prisma.itemVenda.count({ where: { servicoId: id } }),
      this.prisma.itemOrdemServico.count({ where: { servicoId: id } }),
    ]);

    if (agendamentos > 0 || itensVenda > 0 || itensOS > 0) {
      throw new ConflictException(
        'Este serviço possui agendamentos ou vendas vinculadas e não pode ser excluído. Desative-o para que não apareça em novos agendamentos.',
      );
    }

    return this.prisma.servico.delete({ where: { id } });
  }
}
