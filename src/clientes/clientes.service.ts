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

  async findAll(page = 1, limit = 20, busca?: string) {
    const skip = (page - 1) * limit;
    const where = busca
      ? {
          OR: [
            { nome: { contains: busca, mode: 'insensitive' as const } },
            { cpf: { contains: busca } },
            { telefonePrincipal: { contains: busca } },
            { email: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : {};

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

  async findOne(id: string) {
    const cliente = await this.prisma.cliente.findUnique({
      where: { id },
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

  async create(dto: CreateClienteDto) {
    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findUnique({
        where: { cpf },
      });
      if (existing) throw new ConflictException('CPF já cadastrado');
    }

    return this.prisma.cliente.create({ data: { ...dto, cpf } });
  }

  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);

    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findFirst({
        where: { cpf, NOT: { id } },
      });
      if (existing)
        throw new ConflictException('CPF já cadastrado para outro cliente');
    }

    return this.prisma.cliente.update({ where: { id }, data: { ...dto, cpf } });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.cliente.delete({ where: { id } });
  }
}
