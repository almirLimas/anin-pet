import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(clienteId?: string) {
    return this.prisma.pet.findMany({
      where: clienteId ? { clienteId } : undefined,
      orderBy: { nome: 'asc' },
      include: { cliente: { select: { id: true, nome: true } } },
    });
  }

  async findOne(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      include: {
        cliente: true,
        vacinas: { orderBy: { dataAplicacao: 'desc' } },
        agendamentos: {
          orderBy: { dataHora: 'desc' },
          take: 10,
          include: { servico: true },
        },
      },
    });
    if (!pet) throw new NotFoundException('Pet não encontrado');
    return pet;
  }

  async create(dto: CreatePetDto) {
    return this.prisma.pet.create({ data: dto });
  }

  async update(id: string, dto: UpdatePetDto) {
    await this.findOne(id);
    return this.prisma.pet.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.pet.delete({ where: { id } });
  }
}
