import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AvaliacoesService {
  private readonly logger = new Logger(AvaliacoesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Cria um registro de avaliação pendente e retorna o token gerado */
  async criarPendente(
    agendamentoId: string,
    clienteId: string,
    tenantId: string,
  ): Promise<string> {
    const token = randomBytes(32).toString('hex');
    await this.prisma.avaliacaoCliente.create({
      data: { nota: 0, token, agendamentoId, clienteId, tenantId },
    });
    return token;
  }

  /** Registra a nota enviada pelo cliente via link de e-mail */
  async responder(token: string, nota: number): Promise<void> {
    if (nota < 1 || nota > 5) {
      throw new BadRequestException('Nota deve ser entre 1 e 5');
    }
    const avaliacao = await this.prisma.avaliacaoCliente.findUnique({
      where: { token },
    });
    if (!avaliacao) throw new NotFoundException('Avaliação não encontrada');
    if (avaliacao.respondidaEm) {
      throw new BadRequestException('Esta avaliação já foi respondida');
    }
    await this.prisma.avaliacaoCliente.update({
      where: { token },
      data: { nota, respondidaEm: new Date() },
    });
  }

  /** Resumo de satisfação para o dashboard do tenant */
  async resumo(tenantId: string) {
    const avaliacoes = await this.prisma.avaliacaoCliente.findMany({
      where: { tenantId, respondidaEm: { not: null } },
      select: { nota: true },
    });

    const total = avaliacoes.length;
    if (total === 0) {
      return { total: 0, mediaNota: null, percentualPositivo: null };
    }

    const soma = avaliacoes.reduce(
      (acc: number, a: { nota: number }) => acc + a.nota,
      0,
    );
    const mediaNota = Number.parseFloat((soma / total).toFixed(1));
    const positivos = avaliacoes.filter(
      (a: { nota: number }) => a.nota >= 4,
    ).length;
    const percentualPositivo = Math.round((positivos / total) * 100);

    return { total, mediaNota, percentualPositivo };
  }

  /** Lista detalhada das avaliações respondidas */
  listar(tenantId: string) {
    return this.prisma.avaliacaoCliente.findMany({
      where: { tenantId, respondidaEm: { not: null } },
      orderBy: { respondidaEm: 'desc' },
      select: {
        id: true,
        nota: true,
        respondidaEm: true,
        cliente: { select: { id: true, nome: true } },
        agendamento: {
          select: {
            dataHora: true,
            servicos: { include: { servico: { select: { nome: true } } } },
            pet: { select: { nome: true } },
          },
        },
      },
    });
  }
}
