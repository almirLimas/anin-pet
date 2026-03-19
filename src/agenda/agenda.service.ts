import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';

@Injectable()
export class AgendaService {
  constructor(private readonly prisma: PrismaService) {}

  private get include() {
    return {
      cliente: { select: { id: true, nome: true, telefonePrincipal: true } },
      pet: { select: { id: true, nome: true, especie: true } },
      servico: {
        select: { id: true, nome: true, preco: true, duracaoMinutos: true },
      },
    };
  }

  async findAll(data?: string, status?: string) {
    const where: Record<string, unknown> = {};

    if (data) {
      const inicio = new Date(data);
      inicio.setHours(0, 0, 0, 0);
      const fim = new Date(data);
      fim.setHours(23, 59, 59, 999);
      where['dataHora'] = { gte: inicio, lte: fim };
    }

    if (status) {
      where['status'] = status;
    }

    return this.prisma.agendamento.findMany({
      where,
      orderBy: { dataHora: 'asc' },
      include: this.include,
    });
  }

  async findOne(id: string) {
    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id },
      include: this.include,
    });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    return agendamento;
  }

  async create(dto: CreateAgendamentoDto) {
    return this.prisma.agendamento.create({
      data: {
        ...dto,
        dataHora: new Date(dto.dataHora),
      },
      include: this.include,
    });
  }

  async update(id: string, dto: UpdateAgendamentoDto) {
    await this.findOne(id);
    return this.prisma.agendamento.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.dataHora && { dataHora: new Date(dto.dataHora) }),
      } as Prisma.AgendamentoUncheckedUpdateInput,
      include: this.include,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.agendamento.delete({ where: { id } });
  }
}
