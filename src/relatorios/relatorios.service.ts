import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  // â”€â”€ Resumo do mÃªs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async resumoMes(tenantId: string, mes: string) {
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(ano, mesNum - 1, 1);
    const fim = new Date(ano, mesNum, 1);

    const [
      novosClientes,
      totalClientesAtivos,
      agendamentosMes,
      faturamentoMes,
      clientesComAgendamento,
      clientesNaoVoltaram,
    ] = await Promise.all([
      this.prisma.cliente.count({
        where: { tenantId, createdAt: { gte: inicio, lt: fim } },
      }),

      this.prisma.cliente.count({
        where: { tenantId, status: 'Ativo' },
      }),

      this.prisma.agendamento.groupBy({
        by: ['status'],
        where: { tenantId, dataHora: { gte: inicio, lt: fim } },
        _count: { id: true },
      }),

      this.prisma.lancamento.aggregate({
        where: { tenantId, tipo: 'Receita', data: { gte: inicio, lt: fim } },
        _sum: { valor: true },
      }),

      this.prisma.agendamento.findMany({
        where: {
          tenantId,
          dataHora: { gte: inicio, lt: fim },
          status: { in: ['Concluido', 'EmAtendimento', 'Confirmado'] },
        },
        select: { clienteId: true },
        distinct: ['clienteId'],
      }),

      // clientes que nÃ£o voltaram nos Ãºltimos 30 dias (para destaque no card)
      this._contarNaoVoltaram(tenantId, 30),
    ]);

    const totalAgendamentos = agendamentosMes.reduce(
      (acc, g) => acc + g._count.id,
      0,
    );
    const concluidos =
      agendamentosMes.find((g) => g.status === 'Concluido')?._count.id ?? 0;
    const cancelados =
      agendamentosMes.find((g) => g.status === 'Cancelado')?._count.id ?? 0;
    const naoCompareceu =
      agendamentosMes.find((g) => g.status === 'NaoCompareceu')?._count.id ?? 0;

    const clientesRetornaram = clientesComAgendamento.length;
    const taxaRetorno =
      totalClientesAtivos > 0
        ? Math.round((clientesRetornaram / totalClientesAtivos) * 100)
        : 0;

    return {
      mes,
      novosClientes,
      totalClientesAtivos,
      clientesRetornaram,
      clientesNaoVoltaram,
      taxaRetorno,
      agendamentos: {
        total: totalAgendamentos,
        concluidos,
        cancelados,
        naoCompareceu,
      },
      faturamento: Number(faturamentoMes._sum.valor ?? 0),
    };
  }

  // â”€â”€ Clientes que nÃ£o voltaram â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async clientesNaoVoltaram(tenantId: string, dias = 30) {
    const agora = new Date();
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - dias);

    const resultado = await this.prisma.$queryRaw<
      {
        id: string;
        nome: string;
        telefonePrincipal: string;
        email: string | null;
        ultimoAgendamento: Date;
        servicos: string;
      }[]
    >`
      SELECT
        c.id,
        c.nome,
        c."telefonePrincipal",
        c.email,
        MAX(a."dataHora") AS "ultimoAgendamento",
        STRING_AGG(DISTINCT s.nome, ', ') AS servicos
      FROM "Cliente" c
      JOIN "Agendamento" a ON a."clienteId" = c.id
      JOIN "Servico" s ON s.id = a."servicoId"
      WHERE
        a.status = 'Concluido'
        AND c.status = 'Ativo'
        AND c."tenantId" = ${tenantId}
      GROUP BY c.id, c.nome, c."telefonePrincipal", c.email
      HAVING
        MAX(a."dataHora") < ${dataCorte}
        AND NOT EXISTS (
          SELECT 1
          FROM "Agendamento" a2
          WHERE a2."clienteId" = c.id
            AND a2."dataHora" > ${agora}
            AND a2.status NOT IN ('Cancelado', 'NaoCompareceu')
        )
      ORDER BY "ultimoAgendamento" ASC
    `;

    return {
      dias,
      total: resultado.length,
      clientes: resultado.map((c) => ({
        ...c,
        diasSemVoltar: Math.floor(
          (agora.getTime() - new Date(c.ultimoAgendamento).getTime()) /
            86400000,
        ),
      })),
    };
  }

  // â”€â”€ ServiÃ§os mais populares â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  async servicosPopulares(tenantId: string, mes: string) {
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(ano, mesNum - 1, 1);
    const fim = new Date(ano, mesNum, 1);

    const grupos = await this.prisma.agendamento.groupBy({
      by: ['servicoId'],
      where: {
        tenantId,
        dataHora: { gte: inicio, lt: fim },
        status: 'Concluido',
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    if (grupos.length === 0) return [];

    const ids = grupos.map((g) => g.servicoId);
    const detalhes = await this.prisma.servico.findMany({
      where: { tenantId, id: { in: ids } },
      select: { id: true, nome: true, categoria: true, preco: true },
    });

    return grupos.map((g) => {
      const d = detalhes.find((s) => s.id === g.servicoId);
      return {
        servicoId: g.servicoId,
        nome: d?.nome ?? 'Desconhecido',
        categoria: d?.categoria,
        quantidade: g._count.id,
        receitaEstimada: Number(d?.preco ?? 0) * g._count.id,
      };
    });
  }

  // â”€â”€ helper privado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  private async _contarNaoVoltaram(
    tenantId: string,
    dias: number,
  ): Promise<number> {
    const agora = new Date();
    const dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - dias);

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT c.id
      FROM "Cliente" c
      JOIN "Agendamento" a ON a."clienteId" = c.id
      WHERE a.status = 'Concluido'
        AND c.status = 'Ativo'
        AND c."tenantId" = ${tenantId}
      GROUP BY c.id
      HAVING
        MAX(a."dataHora") < ${dataCorte}
        AND NOT EXISTS (
          SELECT 1
          FROM "Agendamento" a2
          WHERE a2."clienteId" = c.id
            AND a2."dataHora" > ${agora}
            AND a2.status NOT IN ('Cancelado', 'NaoCompareceu')
        )
    `;

    return rows.length;
  }
}
