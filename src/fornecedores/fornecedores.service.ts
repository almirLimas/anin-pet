import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFornecedorDto } from './dto/create-fornecedor.dto';
import { UpdateFornecedorDto } from './dto/update-fornecedor.dto';

@Injectable()
export class FornecedoresService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, busca?: string) {
    return this.prisma.fornecedor.findMany({
      where: busca
        ? {
            tenantId,
            OR: [
              { nome: { contains: busca, mode: 'insensitive' } },
              { cnpj: { contains: busca } },
            ],
          }
        : { tenantId },
      orderBy: { nome: 'asc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const fornecedor = await this.prisma.fornecedor.findFirst({
      where: { id, tenantId },
    });
    if (!fornecedor) throw new NotFoundException('Fornecedor não encontrado');
    return fornecedor;
  }

  async create(tenantId: string, dto: CreateFornecedorDto) {
    if (dto.cnpj) {
      const existe = await this.prisma.fornecedor.findUnique({
        where: { tenantId_cnpj: { tenantId, cnpj: dto.cnpj } },
      });
      if (existe)
        throw new ConflictException('Já existe um fornecedor com esse CNPJ');
    }
    return this.prisma.fornecedor.create({ data: { ...dto, tenantId } });
  }

  async update(tenantId: string, id: string, dto: UpdateFornecedorDto) {
    await this.findOne(tenantId, id);
    return this.prisma.fornecedor.update({ where: { id }, data: dto });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.fornecedor.delete({ where: { id } });
  }
}
