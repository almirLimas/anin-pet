import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServicoDto } from './dto/create-servico.dto';
import { UpdateServicoDto } from './dto/update-servico.dto';

@Injectable()
export class ServicosService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(apenasAtivos = false) {
    return this.prisma.servico.findMany({
      where: apenasAtivos ? { ativo: true } : undefined,
      orderBy: [{ categoria: 'asc' }, { nome: 'asc' }],
    });
  }

  async findOne(id: string) {
    const servico = await this.prisma.servico.findUnique({ where: { id } });
    if (!servico) throw new NotFoundException('Serviço não encontrado');
    return servico;
  }

  async create(dto: CreateServicoDto) {
    return this.prisma.servico.create({ data: dto });
  }

  async update(id: string, dto: UpdateServicoDto) {
    await this.findOne(id);
    return this.prisma.servico.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.servico.delete({ where: { id } });
  }
}
