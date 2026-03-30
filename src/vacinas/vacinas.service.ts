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

  async findAll(tenantId: string, petId?: string, status?: string) {
    return this.prisma.vacina.findMany({
      where: {
        tenantId,
        ...(petId && { petId }),
        ...(status && { status: status as StatusVacina }),
      },
      orderBy: { dataAplicacao: 'desc' },
      include: this.include,
    });
  }

  async findOne(tenantId: string, id: string) {
    const vacina = await this.prisma.vacina.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!vacina) throw new NotFoundException('Vacina não encontrada');
    return vacina;
  }

  async create(tenantId: string, dto: CreateVacinaDto) {
    return this.prisma.vacina.create({
      data: {
        ...dto,
        tenantId,
        dataAplicacao: new Date(dto.dataAplicacao),
        ...(dto.dataReforco && { dataReforco: new Date(dto.dataReforco) }),
      },
      include: this.include,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateVacinaDto) {
    await this.findOne(tenantId, id);
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

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.vacina.delete({ where: { id } });
  }
}
