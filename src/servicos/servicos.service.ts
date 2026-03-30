import { Injectable, NotFoundException } from '@nestjs/common';
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
    return this.prisma.servico.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.servico.delete({ where: { id } });
  }
}
