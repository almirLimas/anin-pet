import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, limit = 20, busca?: string) {
    const skip = (page - 1) * limit;
    const where = busca
      ? {
          tenantId,
          OR: [
            { nome: { contains: busca, mode: 'insensitive' as const } },
            { cpf: { contains: busca } },
            { telefonePrincipal: { contains: busca } },
            { email: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        include: { _count: { select: { pets: true } } },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
      include: {
        pets: true,
        agendamentos: {
          orderBy: { dataHora: 'desc' },
          take: 10,
          include: { servico: true },
        },
      },
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  async create(tenantId: string, dto: CreateClienteDto) {
    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findFirst({
        where: { tenantId, cpf },
      });
      if (existing) throw new ConflictException('CPF já cadastrado');
    }

    const { pets, ...clienteData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: { ...clienteData, cpf, tenantId },
      });

      if (pets && pets.length > 0) {
        await tx.pet.createMany({
          data: pets.map((pet) => ({
            ...pet,
            clienteId: cliente.id,
            tenantId,
          })),
        });
      }

      return tx.cliente.findFirst({
        where: { id: cliente.id },
        include: { pets: true },
      });
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClienteDto) {
    await this.findOne(tenantId, id);

    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findFirst({
        where: { tenantId, cpf, NOT: { id } },
      });
      if (existing)
        throw new ConflictException('CPF já cadastrado para outro cliente');
    }

    return this.prisma.cliente.update({
      where: { id },
      data: { ...dto, cpf, pets: undefined },
      include: { pets: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.cliente.delete({ where: { id } });
  }
}
