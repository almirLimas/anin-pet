import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, clienteId?: string) {
    return this.prisma.pet.findMany({
      where: clienteId ? { tenantId, clienteId } : { tenantId },
      orderBy: { nome: 'asc' },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  }

  async findOne(tenantId: string, id: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id, tenantId },
      include: {
        cliente: true,
        vacinas: { orderBy: { dataAplicacao: 'desc' } },
        agendamentos: {
          orderBy: { dataHora: 'desc' },
          take: 10,
          include: { servicos: { include: { servico: true } } },
        },
      },
    });
    if (!pet) throw new NotFoundException('Pet não encontrado');
    return pet;
  }

  async create(tenantId: string, dto: CreatePetDto) {
    return this.prisma.pet.create({ data: { ...dto, tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdatePetDto) {
    await this.findOne(tenantId, id);
    return this.prisma.pet.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.pet.delete({ where: { id } });
  }
}
