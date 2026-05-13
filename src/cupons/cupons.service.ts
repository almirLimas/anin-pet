import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCupomDto } from './dto/create-cupom.dto';
import { UpdateCupomDto } from './dto/update-cupom.dto';

@Injectable()
export class CuponsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.cupom.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const cupom = await this.prisma.cupom.findFirst({
      where: { id, tenantId },
    });
    if (!cupom) throw new NotFoundException('Cupom não encontrado');
    return cupom;
  }

  async create(tenantId: string, dto: CreateCupomDto) {
    const codigo = dto.codigo.toUpperCase();
    const existe = await this.prisma.cupom.findUnique({
      where: { tenantId_codigo: { tenantId, codigo } },
    });
    if (existe)
      throw new ConflictException('Já existe um cupom com esse código');

    return this.prisma.cupom.create({
      data: {
        ...dto,
        codigo,
        tenantId,
        expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : null,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateCupomDto) {
    await this.findOne(tenantId, id);
    return this.prisma.cupom.update({
      where: { id },
      data: {
        ...dto,
        codigo: dto.codigo?.toUpperCase(),
        expiraEm: dto.expiraEm ? new Date(dto.expiraEm) : undefined,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.cupom.delete({ where: { id } });
  }

  // Usado pelo PDV para validar e calcular desconto
  async validar(tenantId: string, codigo: string, subtotal: number) {
    const cupom = await this.prisma.cupom.findUnique({
      where: { tenantId_codigo: { tenantId, codigo: codigo.toUpperCase() } },
    });

    if (!cupom || !cupom.ativo) {
      throw new NotFoundException('Cupom inválido ou inativo');
    }
    if (cupom.expiraEm && cupom.expiraEm < new Date()) {
      throw new BadRequestException('Cupom expirado');
    }
    if (cupom.usoMaximo !== null && cupom.usoAtual >= cupom.usoMaximo) {
      throw new BadRequestException('Cupom atingiu o limite de usos');
    }

    const desconto =
      cupom.tipo === 'Percentual'
        ? (subtotal * Number(cupom.valor)) / 100
        : Math.min(Number(cupom.valor), subtotal);

    return {
      cupomId: cupom.id,
      codigo: cupom.codigo,
      tipo: cupom.tipo,
      valor: Number(cupom.valor),
      desconto: Math.round(desconto * 100) / 100,
    };
  }
}
