import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { EstoqueService } from '../estoque/estoque.service';
import { AgendaService } from '../agenda/agenda.service';
import { AddItemOsDto } from './dto/add-item-os.dto';
import { FinalizarOsDto } from './dto/finalizar-os.dto';

@Injectable()
export class OrdemServicoService {
  private readonly logger = new Logger(OrdemServicoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
    private readonly estoque: EstoqueService,
    private readonly agenda: AgendaService,
  ) {}

  private get include() {
    return {
      agendamento: {
        include: {
          cliente: {
            select: {
              id: true,
              nome: true,
              telefonePrincipal: true,
              mensalista: true,
              valorMensal: true,
            },
          },
          pet: { select: { id: true, nome: true, especie: true, raca: true } },
          servicos: {
            include: {
              servico: { select: { id: true, nome: true, preco: true } },
            },
          },
        },
      },
      itens: {
        include: {
          produto: { select: { id: true, nome: true, unidade: true } },
        },
      },
    };
  }

  /** Sincroniza os itens de serviço de uma OS aberta com os serviços atuais do agendamento:
   *  - Remove itens de serviço que não existem mais no agendamento
   *  - Adiciona itens para novos serviços do agendamento
   *  - Atualiza nome e preço dos itens existentes
   */
  private async syncItensServico(
    osId: string,
    tenantId: string,
    servicos: Array<{ servico: { id: string; nome: string; preco: unknown } }>,
    isMensalista: boolean,
  ) {
    const servicoIds = servicos.map((as) => as.servico.id);

    // Proteção: se não houver serviços no agendamento, não mexe nos itens.
    if (servicoIds.length === 0) return;

    // 1. Remove itens de serviço cujo servicoId não está mais no agendamento..
    await this.prisma.itemOrdemServico.deleteMany({
      where: {
        ordemServicoId: osId,
        tipo: 'Servico',
        NOT: { servicoId: { in: servicoIds } },
      },
    });

    for (const as of servicos) {
      const nomeAtual = isMensalista
        ? `${as.servico.nome} (Mensalista)`
        : as.servico.nome;
      const precoAtual = isMensalista ? 0 : Number(as.servico.preco);

      const itemExistente = await this.prisma.itemOrdemServico.findFirst({
        where: { ordemServicoId: osId, servicoId: as.servico.id },
        select: { id: true, quantidade: true },
      });

      if (itemExistente) {
        // 2. Atualiza nome e preço do item existente
        await this.prisma.itemOrdemServico.update({
          where: { id: itemExistente.id },
          data: {
            nome: nomeAtual,
            precoUnitario: precoAtual,
            subtotal: precoAtual * Number(itemExistente.quantidade),
          },
        });
      } else {
        // 3. Cria item para serviço novo no agendamento
        await this.prisma.itemOrdemServico.create({
          data: {
            ordemServicoId: osId,
            tipo: 'Servico',
            nome: nomeAtual,
            quantidade: 1,
            precoUnitario: precoAtual,
            subtotal: precoAtual,
            servicoId: as.servico.id,
            tenantId,
          },
        });
      }
    }
  }

  async criarParaAgendamento(tenantId: string, agendamentoId: string) {
    const agendamento = await this.prisma.agendamento.findFirst({
      where: { id: agendamentoId, tenantId },
      include: {
        servicos: { include: { servico: true } },
        cliente: { select: { mensalista: true } },
      },
    });

    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');

    const jaExiste = await this.prisma.ordemServico.findUnique({
      where: { agendamentoId },
      include: this.include,
    });
    if (jaExiste) {
      // Se o agendamento já foi concluído mas a OS ainda está Aberta, corrige o status
      if (agendamento.status === 'Concluido' && jaExiste.status === 'Aberta') {
        await this.prisma.ordemServico.update({
          where: { id: jaExiste.id },
          data: { status: 'Concluida' },
        });
        return this.findOne(tenantId, jaExiste.id);
      }

      // Se a OS ainda está aberta, sincroniza nome e preço dos itens de serviço
      // com os dados atuais do cadastro (caso o serviço tenha sido editado)
      if (jaExiste.status === 'Aberta') {
        await this.syncItensServico(
          jaExiste.id,
          tenantId,
          agendamento.servicos,
          agendamento.cliente.mensalista,
        );
        return this.findOne(tenantId, jaExiste.id);
      }

      return jaExiste;
    }

    if (['Cancelado', 'NaoCompareceu'].includes(agendamento.status)) {
      throw new BadRequestException(
        'Não é possível abrir OS para agendamento cancelado ou com não comparecimento',
      );
    }

    // Gera número sequencial por tenant
    const ultimo = await this.prisma.ordemServico.findFirst({
      where: { tenantId },
      orderBy: { numero: 'desc' },
      select: { numero: true },
    });
    const numero = (ultimo?.numero ?? 0) + 1;

    // Cria OS com itens baseados nos serviços do agendamento
    const isMensalista = agendamento.cliente.mensalista;
    // Se agendamento já foi concluído (via modal da agenda), OS nasce finalizada
    const jaConcluido = agendamento.status === 'Concluido';

    const os = await this.prisma.ordemServico.create({
      data: {
        numero,
        agendamentoId,
        tenantId,
        ...(jaConcluido && { status: 'Concluida' }),
        itens: {
          create: agendamento.servicos.map((as) => ({
            tipo: 'Servico' as const,
            nome: isMensalista
              ? `${as.servico.nome} (Mensalista)`
              : as.servico.nome,
            quantidade: 1,
            precoUnitario: isMensalista ? 0 : as.servico.preco,
            subtotal: isMensalista ? 0 : as.servico.preco,
            servicoId: as.servico.id,
            tenantId,
          })),
        },
      },
      include: this.include,
    });

    // Se o agendamento ainda não está em EmAtendimento, atualiza
    if (
      agendamento.status === 'Agendado' ||
      agendamento.status === 'Confirmado'
    ) {
      await this.prisma.agendamento.update({
        where: { id: agendamentoId },
        data: { status: 'EmAtendimento' },
      });
    }

    return os;
  }

  async findByAgendamento(tenantId: string, agendamentoId: string) {
    const os = await this.prisma.ordemServico.findFirst({
      where: { agendamentoId, tenantId },
      include: this.include,
    });
    return os ?? null;
  }

  async findOne(tenantId: string, id: string) {
    const os = await this.prisma.ordemServico.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!os) throw new NotFoundException('Ordem de Serviço não encontrada');
    return os;
  }

  async addItem(tenantId: string, id: string, dto: AddItemOsDto) {
    const os = await this.findOne(tenantId, id);

    if (os.status !== 'Aberta') {
      throw new BadRequestException('Ordem de Serviço já foi encerrada');
    }

    const subtotal = dto.precoUnitario * dto.quantidade;

    return this.prisma.itemOrdemServico.create({
      data: {
        ordemServicoId: id,
        tipo: dto.tipo,
        nome: dto.nome,
        quantidade: dto.quantidade,
        precoUnitario: dto.precoUnitario,
        subtotal,
        produtoId: dto.produtoId,
        servicoId: dto.servicoId,
        tenantId,
      },
      include: {
        produto: { select: { id: true, nome: true, unidade: true } },
      },
    });
  }

  async removeItem(tenantId: string, osId: string, itemId: string) {
    const os = await this.findOne(tenantId, osId);

    if (os.status !== 'Aberta') {
      throw new BadRequestException('Ordem de Serviço já foi encerrada');
    }

    const item = await this.prisma.itemOrdemServico.findFirst({
      where: { id: itemId, ordemServicoId: osId, tenantId },
    });
    if (!item) throw new NotFoundException('Item não encontrado');

    // Não permite remover itens de serviço (originados do agendamento)
    if (item.tipo === 'Servico') {
      throw new BadRequestException(
        'Itens de serviço não podem ser removidos da OS',
      );
    }

    return this.prisma.itemOrdemServico.delete({ where: { id: itemId } });
  }

  async finalizar(
    tenantId: string,
    id: string,
    usuarioId: string,
    dto: FinalizarOsDto,
  ) {
    const os = await this.findOne(tenantId, id);

    if (os.status !== 'Aberta') {
      throw new ConflictException('Ordem de Serviço já foi encerrada');
    }

    const totalItens = os.itens.reduce(
      (sum, item) => sum + Number(item.subtotal),
      0,
    );
    const desconto = dto.desconto ?? 0;
    const valorTotal = Math.max(0, totalItens - desconto);

    // Coleta itens de produto para descontar do estoque
    const itensProduto = os.itens.filter(
      (item) => item.tipo === 'Produto' && item.produtoId,
    );

    // Executa tudo em uma transação
    await this.prisma.$transaction(async (tx) => {
      // 1. Atualiza a OS
      await tx.ordemServico.update({
        where: { id },
        data: {
          status: 'Concluida',
          formaPagamento: dto.formaPagamento,
          desconto,
          observacoes: dto.observacoes,
        },
      });

      // 2. Desconta produtos do estoque (fora da transação por conta do serviço existente)
    });

    // 3. Desconta produtos do estoque (separado pois usa EstoqueService com validação)
    for (const item of itensProduto) {
      try {
        await this.estoque.createMovimentacao(
          tenantId,
          {
            produtoId: item.produtoId!,
            tipo: 'Saida',
            quantidade: Number(item.quantidade),
            precoUnitario: Number(item.precoUnitario),
            motivo: `OS #${os.numero} — ${os.agendamento.pet.nome}`,
          },
          usuarioId,
        );
      } catch (err) {
        this.logger.warn(
          `Não foi possível descontar produto ${item.produtoId} do estoque: ${String(err)}`,
        );
      }
    }

    // 4. Cria lançamento financeiro
    const nomesServicos = os.itens
      .filter((i) => i.tipo === 'Servico')
      .map((i) => i.nome)
      .join(', ');

    const taxaBusca = os.agendamento.taxaBusca
      ? Number(os.agendamento.taxaBusca)
      : 0;

    const valorComTaxa = valorTotal + taxaBusca;

    // Para mensalistas com recorrência: verifica se é o último agendamento do grupo
    const agendamento = await this.prisma.agendamento.findUnique({
      where: { id: os.agendamentoId },
      select: { recorrenciaId: true },
    });

    const isMensalista = os.agendamento.cliente.mensalista;
    const valorMensal = Number(os.agendamento.cliente.valorMensal ?? 0);
    const recorrenciaId = agendamento?.recorrenciaId;

    let descricaoLancamento =
      taxaBusca > 0
        ? `${nomesServicos} — ${os.agendamento.pet.nome} (+ taxa de busca)`
        : `${nomesServicos} — ${os.agendamento.pet.nome}`;

    let valorLancamento = valorComTaxa;

    if (isMensalista && recorrenciaId && valorMensal > 0) {
      // Conta sessões já concluídas no grupo (excluindo a atual, que ainda não está Concluido)
      const jaCompletos = await this.prisma.agendamento.count({
        where: {
          recorrenciaId,
          id: { not: os.agendamentoId },
          status: 'Concluido',
        },
      });

      const sessoesCompletas = jaCompletos + 1; // inclui a atual

      if (sessoesCompletas % 4 === 0) {
        // A cada 4 sessões → gera cobrança de mensalidade
        valorLancamento = valorMensal + taxaBusca;
        descricaoLancamento =
          taxaBusca > 0
            ? `Mensalidade — ${os.agendamento.pet.nome} (+ taxa de busca)`
            : `Mensalidade — ${os.agendamento.pet.nome}`;
      } else {
        // Sessão intermediária — sem lançamento
        valorLancamento = 0;
      }
    }

    if (valorLancamento > 0) {
      await this.financeiro.criar(
        {
          tipo: 'Receita',
          valor: valorLancamento,
          descricao: descricaoLancamento,
          categoria: 'Servico',
          agendamentoId: os.agendamentoId,
        },
        tenantId,
      );
    }

    // 5. Conclui o agendamento (o agenda.service.update checa jaExiste no lancamento, então não duplica)
    await this.agenda.update(tenantId, os.agendamentoId, {
      status: 'Concluido',
    });

    return this.findOne(tenantId, id);
  }
}
