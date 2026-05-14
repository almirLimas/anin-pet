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
        const isMensalista = agendamento.cliente.mensalista;
        const syncUpdates = jaExiste.itens
          .filter((item) => item.tipo === 'Servico' && item.servicoId)
          .flatMap((item) => {
            const servicoAtual = agendamento.servicos.find(
              (as) => as.servico.id === item.servicoId,
            );
            if (!servicoAtual) return [];

            const nomeEsperado = isMensalista
              ? `${servicoAtual.servico.nome} (Mensalista)`
              : servicoAtual.servico.nome;
            const precoEsperado = isMensalista
              ? 0
              : Number(servicoAtual.servico.preco);

            if (
              item.nome !== nomeEsperado ||
              Number(item.precoUnitario) !== precoEsperado
            ) {
              return [
                this.prisma.itemOrdemServico.update({
                  where: { id: item.id },
                  data: {
                    nome: nomeEsperado,
                    precoUnitario: precoEsperado,
                    subtotal: precoEsperado * Number(item.quantidade),
                  },
                }),
              ];
            }
            return [];
          });

        if (syncUpdates.length > 0) {
          await this.prisma.$transaction(syncUpdates);
          return this.findOne(tenantId, jaExiste.id);
        }
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
