import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StatusVacina } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVacinaDto } from './dto/create-vacina.dto';
import { UpdateVacinaDto } from './dto/update-vacina.dto';

@Injectable()
export class VacinasService {
  constructor(private readonly prisma: PrismaService) {}

  private get include() {
    return {
      pet: {
        select: {
          id: true,
          nome: true,
          especie: true,
          cliente: { select: { id: true, nome: true } },
        },
      },
    };
  }

  async findAll(petId?: string, status?: string) {
    return this.prisma.vacina.findMany({
      where: {
        ...(petId && { petId }),
        ...(status && { status: status as StatusVacina }),
      },
      orderBy: { dataAplicacao: 'desc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const vacina = await this.prisma.vacina.findUnique({
      where: { id },
      include: this.include,
    });
    if (!vacina) throw new NotFoundException('Vacina não encontrada');
    return vacina;
  }

  async create(dto: CreateVacinaDto) {
    return this.prisma.vacina.create({
      data: {
        ...dto,
        dataAplicacao: new Date(dto.dataAplicacao),
        ...(dto.dataReforco && { dataReforco: new Date(dto.dataReforco) }),
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateVacinaDto) {
    await this.findOne(id);
    return this.prisma.vacina.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dataAplicacao && {
          dataAplicacao: new Date(dto.dataAplicacao),
        }),
        ...(dto.dataReforco && { dataReforco: new Date(dto.dataReforco) }),
      } as Prisma.VacinaUncheckedUpdateInput,
      include: this.include,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.vacina.delete({ where: { id } });
  }
}
