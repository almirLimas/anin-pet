import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAgendamentoDto } from './dto/create-agendamento.dto';
import { UpdateAgendamentoDto } from './dto/update-agendamento.dto';
import { CreateAgendamentoRecorrenteDto } from './dto/create-agendamento-recorrente.dto';
import { FinanceiroService } from '../financeiro/financeiro.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { AvaliacoesService } from '../avaliacoes/avaliacoes.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly financeiro: FinanceiroService,
    private readonly whatsapp: WhatsappService,
    private readonly avaliacoes: AvaliacoesService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  private get include() {
    return {
      cliente: {
        select: {
          id: true,
          nome: true,
          telefonePrincipal: true,
          mensalista: true,
        },
      },
      pet: { select: { id: true, nome: true, especie: true } },
      servicos: {
        include: {
          servico: {
            select: { id: true, nome: true, preco: true, duracaoMinutos: true },
          },
        },
      },
      ordemServico: { select: { id: true, status: true } },
      pacoteAtivo: {
        select: {
          id: true,
          sessoesUsadas: true,
          totalSessoes: true,
          status: true,
          pacote: { select: { nome: true } },
        },
      },
    };
  }

  async findAll(tenantId: string, data?: string, status?: string) {
    const where: Record<string, unknown> = { tenantId };

    if (data) {
      const inicio = new Date(`${data}T00:00:00`);
      const fim = new Date(`${data}T23:59:59.999`);
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

  async concluidosSemanaEMes(tenantId: string): Promise<{
    semana: number;
    mes: number;
  }> {
    const agora = new Date();
    // Início da semana (domingo)
    const inicioDaSemana = new Date(agora);
    inicioDaSemana.setDate(agora.getDate() - agora.getDay());
    inicioDaSemana.setHours(0, 0, 0, 0);
    // Início do mês
    const inicioDoMes = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1,
      0,
      0,
      0,
      0,
    );

    const [semana, mes] = await Promise.all([
      this.prisma.agendamento.count({
        where: {
          tenantId,
          status: 'Concluido',
          dataHora: { gte: inicioDaSemana },
        },
      }),
      this.prisma.agendamento.count({
        where: {
          tenantId,
          status: 'Concluido',
          dataHora: { gte: inicioDoMes },
        },
      }),
    ]);

    return { semana, mes };
  }

  async resumoMes(tenantId: string, mes: string) {
    const [ano, mesNum] = mes.split('-').map(Number);
    const inicio = new Date(ano, mesNum - 1, 1, 0, 0, 0, 0);
    const fim = new Date(ano, mesNum, 0, 23, 59, 59, 999);

    const agendamentos = await this.prisma.agendamento.findMany({
      where: { tenantId, dataHora: { gte: inicio, lte: fim } },
      select: { dataHora: true, status: true },
    });

    const byDate: Record<
      string,
      {
        total: number;
        agendados: number;
        concluidos: number;
        cancelados: number;
        naoCompareceu: number;
      }
    > = {};

    for (const a of agendamentos) {
      const d = `${a.dataHora.getFullYear()}-${String(a.dataHora.getMonth() + 1).padStart(2, '0')}-${String(a.dataHora.getDate()).padStart(2, '0')}`;
      if (!byDate[d]) {
        byDate[d] = {
          total: 0,
          agendados: 0,
          concluidos: 0,
          cancelados: 0,
          naoCompareceu: 0,
        };
      }
      byDate[d].total++;
      if (['Agendado', 'Confirmado', 'EmAtendimento'].includes(a.status))
        byDate[d].agendados++;
      if (a.status === 'Concluido') byDate[d].concluidos++;
      if (a.status === 'Cancelado') byDate[d].cancelados++;
      if (a.status === 'NaoCompareceu') byDate[d].naoCompareceu++;
    }

    return Object.entries(byDate).map(([data, counts]) => ({
      data,
      ...counts,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const agendamento = await this.prisma.agendamento.findFirst({
      where: { id, tenantId },
      include: this.include,
    });
    if (!agendamento) throw new NotFoundException('Agendamento não encontrado');
    return agendamento;
  }

  async create(tenantId: string, dto: CreateAgendamentoDto) {
    const {
      servicoIds,
      taxaBusca,
      dataHora,
      pacoteClienteAtivoId,
      gaiola: gaiolaRequisitada,
      ...rest
    } = dto;

    // Usa a gaiola solicitada se informada, senão auto-atribui a próxima livre
    const gaiola =
      gaiolaRequisitada ??
      (await this._proxGaiolaLivre(tenantId, new Date(dataHora)));

    const agendamento = await this.prisma.agendamento.create({
      data: {
        ...rest,
        tenantId,
        dataHora: new Date(dataHora),
        ...(taxaBusca !== undefined && { taxaBusca }),
        ...(pacoteClienteAtivoId && { pacoteClienteAtivoId }),
        ...(gaiola !== null && { gaiola, statusGaiola: 'Aguardando' }),
        servicos: {
          create: servicoIds.map((sid) => ({ servicoId: sid })),
        },
      },
      include: this.include,
    });

    // Notificação WhatsApp ao cliente (apenas plano Plus)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { mensagemAgendamento: true, plano: true },
    });
    const telefone = agendamento.cliente.telefonePrincipal;
    if (telefone && tenant?.plano === 'plus') {
      const dataFormatada = agendamento.dataHora.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo',
      });
      const horaFormatada = agendamento.dataHora.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      });
      const nomesServicos = agendamento.servicos
        .map((s) => s.servico.nome)
        .join(', ');

      const templatePadrao =
        'Olá, {nome}! 🐾 Seu agendamento para {pet} foi confirmado.\nServiço: {servico}\nData: {data} às {hora}\nAté lá! 😊';

      const mensagem = (tenant?.mensagemAgendamento ?? templatePadrao)
        .replaceAll('{nome}', agendamento.cliente.nome)
        .replaceAll('{pet}', agendamento.pet.nome)
        .replaceAll('{servico}', nomesServicos)
        .replaceAll('{data}', dataFormatada)
        .replaceAll('{hora}', horaFormatada);

      this.whatsapp
        .enviar(
          { telefone, mensagem, nomeCliente: agendamento.cliente.nome },
          tenantId,
        )
        .catch((err: unknown) =>
          this.logger.error(`Falha ao notificar WhatsApp: ${String(err)}`),
        );
    }

    return agendamento;
  }

  async criarRecorrente(tenantId: string, dto: CreateAgendamentoRecorrenteDto) {
    const recorrenciaId = createId();
    const semanas = dto.quantidadeSemanas ?? 4;

    // Calcula a primeira ocorrência do dia da semana a partir de dataInicio
    const base = dto.dataInicio
      ? new Date(`${dto.dataInicio}T00:00:00`)
      : new Date();
    const diff = (dto.diaDaSemana - base.getDay() + 7) % 7;
    base.setDate(base.getDate() + diff);

    const [hora, minuto] = dto.hora.split(':').map(Number);

    const agendamentos = await Promise.all(
      Array.from({ length: semanas }, (_, i) => {
        const dt = new Date(base);
        dt.setDate(dt.getDate() + i * 7);
        dt.setHours(hora, minuto, 0, 0);
        return this.prisma.agendamento.create({
          data: {
            recorrenciaId,
            dataHora: dt,
            clienteId: dto.clienteId,
            petId: dto.petId,
            tenantId,
            modalidade: dto.modalidade ?? 'ClienteTraz',
            ...(dto.taxaBusca !== undefined && { taxaBusca: dto.taxaBusca }),
            ...(dto.enderecoBusca && { enderecoBusca: dto.enderecoBusca }),
            ...(dto.observacoes && { observacoes: dto.observacoes }),
            ...(dto.pacoteClienteAtivoId && {
              pacoteClienteAtivoId: dto.pacoteClienteAtivoId,
            }),
            servicos: {
              create: dto.servicoIds.map((sid) => ({ servicoId: sid })),
            },
          },
          include: this.include,
        });
      }),
    );

    return agendamentos;
  }

  /** Retorna o painel de gaiolas de um dia */
  async buscarGaiolas(tenantId: string, data: string) {
    const inicio = new Date(`${data}T00:00:00`);
    const fim = new Date(`${data}T23:59:59.999`);

    const [agendamentos, tenant] = await Promise.all([
      this.prisma.agendamento.findMany({
        where: {
          tenantId,
          dataHora: { gte: inicio, lte: fim },
          gaiola: { not: null },
          status: { notIn: ['Cancelado'] },
        },
        orderBy: { gaiola: 'asc' },
        include: {
          cliente: {
            select: { id: true, nome: true, telefonePrincipal: true },
          },
          pet: { select: { id: true, nome: true, especie: true } },
          servicos: {
            include: { servico: { select: { id: true, nome: true } } },
          },
        },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { totalGaiolas: true },
      }),
    ]);

    const total = tenant?.totalGaiolas ?? 10;
    const ocupadas = new Map(agendamentos.map((a) => [a.gaiola as number, a]));

    return Array.from({ length: total }, (_, i) => ({
      numero: i + 1,
      agendamento: ocupadas.get(i + 1) ?? null,
    }));
  }

  /** Atualiza o status de gaiola de um agendamento e sincroniza o status principal */
  async atualizarStatusGaiola(
    tenantId: string,
    id: string,
    statusGaiola: string,
    formaPagamento?: string,
    clienteJaBuscou?: boolean,
  ) {
    // Ao marcar como Pronto, delega ao update() para disparar financeiro + avaliação
    if (statusGaiola === 'Pronto') {
      await this.update(tenantId, id, {
        status: 'Concluido',
        clienteJaBuscou: clienteJaBuscou ?? true,
        ...(formaPagamento ? { formaPagamento } : {}),
      });
      return this.prisma.agendamento.update({
        where: { id, tenantId },
        data: { statusGaiola: 'Pronto' },
        select: { id: true, gaiola: true, statusGaiola: true, status: true },
      });
    }

    // Mapeamento de statusGaiola → status principal
    const statusMap: Record<string, string | null> = {
      Aguardando: null,
      EmBanho: 'EmAtendimento',
      Secando: null,
    };

    const novoStatus = statusMap[statusGaiola];

    return this.prisma.agendamento.update({
      where: { id, tenantId },
      data: {
        statusGaiola: statusGaiola as import('@prisma/client').StatusGaiola,
        ...(novoStatus && {
          status: novoStatus as import('@prisma/client').StatusAgendamento,
        }),
      },
      select: { id: true, gaiola: true, statusGaiola: true, status: true },
    });
  }

  /** Encontra o número da próxima gaiola livre para o dia */
  private async _proxGaiolaLivre(
    tenantId: string,
    dataHora: Date,
  ): Promise<number | null> {
    const inicio = new Date(dataHora);
    inicio.setHours(0, 0, 0, 0);
    const fim = new Date(dataHora);
    fim.setHours(23, 59, 59, 999);

    const [ocupadas, tenant] = await Promise.all([
      this.prisma.agendamento.findMany({
        where: {
          tenantId,
          dataHora: { gte: inicio, lte: fim },
          gaiola: { not: null },
          status: { notIn: ['Cancelado'] },
        },
        select: { gaiola: true },
      }),
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { totalGaiolas: true },
      }),
    ]);

    const total = tenant?.totalGaiolas ?? 10;
    const nums = new Set(ocupadas.map((a) => a.gaiola as number));
    for (let n = 1; n <= total; n++) {
      if (!nums.has(n)) return n;
    }
    return null; // todas ocupadas
  }

  async update(tenantId: string, id: string, dto: UpdateAgendamentoDto) {
    await this.findOne(tenantId, id);
    const { servicoIds, clienteJaBuscou, ...restDto } = dto;

    // Monta explicitamente apenas os campos que foram enviados na requisição
    const data: Prisma.AgendamentoUncheckedUpdateInput = {};
    if (restDto.status !== undefined) data.status = restDto.status;
    if (restDto.dataHora !== undefined)
      data.dataHora = new Date(restDto.dataHora);
    if (restDto.modalidade !== undefined) data.modalidade = restDto.modalidade;
    if (restDto.taxaBusca !== undefined) data.taxaBusca = restDto.taxaBusca;
    if (restDto.enderecoBusca !== undefined)
      data.enderecoBusca = restDto.enderecoBusca?.trim() || null;
    if (restDto.observacoes !== undefined)
      data.observacoes = restDto.observacoes?.trim() || null;
    if (servicoIds !== undefined)
      data.servicos = {
        deleteMany: {},
        create: servicoIds.map((sid) => ({ servicoId: sid })),
      };

    // Ao concluir, sincroniza status da gaiola para Pronto (se houver gaiola)
    if (restDto.status === 'Concluido') {
      const atual = await this.prisma.agendamento.findUnique({
        where: { id },
        select: { gaiola: true },
      });
      if (atual?.gaiola) {
        data.statusGaiola = 'Pronto';
      }
    }

    const atualizado = await this.prisma.agendamento.update({
      where: { id },
      data,
      include: this.include,
    });

    // Cancela lançamento financeiro se o agendamento for cancelado
    if (dto.status === 'Cancelado') {
      await this.prisma.lancamento.deleteMany({
        where: { agendamentoId: id },
      });
    }

    // Auto-lançamento financeiro ao concluir
    if (dto.status === 'Concluido') {
      // Auto-desconto de sessão do pacote vinculado
      if (atualizado.pacoteAtivo?.status === 'Ativo') {
        const novoTotal = atualizado.pacoteAtivo.sessoesUsadas + 1;
        const esgotado = novoTotal >= atualizado.pacoteAtivo.totalSessoes;
        await this.prisma.pacoteClienteAtivo.update({
          where: { id: atualizado.pacoteAtivo.id },
          data: {
            sessoesUsadas: novoTotal,
            ...(esgotado && { status: 'Expirado' }),
          },
        });

        // Quando o pacote esgota, gera lançamento financeiro com o valor do pacote
        if (esgotado) {
          const pacoteCompleto =
            await this.prisma.pacoteClienteAtivo.findUnique({
              where: { id: atualizado.pacoteAtivo.id },
              select: {
                valor: true,
                pacote: { select: { nome: true } },
                cliente: { select: { nome: true } },
                pet: { select: { nome: true } },
              },
            });
          if (pacoteCompleto) {
            const nomeCliente = pacoteCompleto.cliente?.nome ?? '';
            const nomePet = pacoteCompleto.pet?.nome ?? '';
            const nomePacote = pacoteCompleto.pacote?.nome ?? 'Pacote';
            await this.financeiro.criar(
              {
                tipo: 'Receita',
                valor: Number(pacoteCompleto.valor),
                descricao: `${nomePacote} — ${nomePet} (${nomeCliente}) · pacote concluído`,
                categoria: 'Servico',
              },
              tenantId,
            );
          }
        }
      }
      const jaExiste = await this.prisma.lancamento.findFirst({
        where: { agendamentoId: id },
      });
      // Agendamentos vinculados a pacote não geram lançamento por sessão
      // (o lançamento do pacote é gerado ao concluir todas as sessões)
      if (!jaExiste && !atualizado.pacoteClienteAtivoId) {
        const taxaBusca = atualizado.taxaBusca
          ? Number(atualizado.taxaBusca)
          : 0;
        const totalServicos = atualizado.servicos.reduce(
          (sum, as) => sum + Number(as.servico.preco),
          0,
        );
        const valorTotal = totalServicos + taxaBusca;
        const nomesServicos = atualizado.servicos
          .map((as) => as.servico.nome)
          .join(', ');
        const descricao =
          taxaBusca > 0
            ? `${nomesServicos} — ${atualizado.pet.nome} (+ taxa de busca)`
            : `${nomesServicos} — ${atualizado.pet.nome}`;

        await this.financeiro.criar(
          {
            tipo: 'Receita',
            valor: valorTotal,
            descricao,
            categoria: 'Servico',
            agendamentoId: id,
            formaPagamento: restDto.formaPagamento ?? undefined,
          },
          tenantId,
        );
      }

      // Alerta interno para o admin
      const tenant = await this.prisma.tenant
        .findUnique({
          where: { id: tenantId },
          select: { nome: true },
        })
        .catch(() => null);
      const totalServicos = atualizado.servicos.reduce(
        (sum, as) => sum + Number(as.servico.preco),
        0,
      );
      const taxaBusca = atualizado.taxaBusca ? Number(atualizado.taxaBusca) : 0;
      this.email
        .enviarAlertaAgendamentoConcluido({
          nomePetshop: tenant?.nome ?? tenantId,
          tenantId,
          nomeCliente: atualizado.cliente.nome,
          nomePet: atualizado.pet.nome,
          servicos: atualizado.servicos.map((as) => as.servico.nome).join(', '),
          formaPagamento: restDto.formaPagamento ?? null,
          valor: totalServicos + taxaBusca,
        })
        .catch((err: unknown) =>
          this.logger.error(
            '[Admin] Falha ao enviar alerta de agendamento',
            String(err),
          ),
        );

      // Pesquisa de satisfação: imediata ou agendada para 1 hora
      if (clienteJaBuscou === false) {
        // Cliente ainda não está com o pet — avisa que está pronto e agenda avaliação para 1 hora
        const em1Hora = new Date(Date.now() + 60 * 60 * 1000);
        await this.prisma.agendamento.update({
          where: { id },
          data: { avaliacaoAgendarEm: em1Hora },
        });
        this.logger.log(
          `[Satisfação] Agendamento ${id} — envio de avaliação agendado para ${em1Hora.toISOString()}`,
        );

        if (
          atualizado.modalidade === 'ClienteTraz' &&
          atualizado.cliente.telefonePrincipal
        ) {
          const petNome = atualizado.pet.nome;
          const clienteNome = atualizado.cliente.nome.split(' ')[0];

          const tenantConfig = await this.prisma.tenant
            .findUnique({
              where: { id: tenantId },
              select: { mensagemPetPronto: true },
            })
            .catch(() => null);

          const template =
            tenantConfig?.mensagemPetPronto ??
            'Olá, {nome}! 🐾 O {pet} já está prontinho e esperando por você!\n\nPode vir buscar quando quiser. 😊';
          const mensagemPronto = template
            .replaceAll('{nome}', clienteNome)
            .replaceAll('{pet}', petNome);

          this.whatsapp
            .enviar(
              {
                telefone: atualizado.cliente.telefonePrincipal,
                mensagem: mensagemPronto,
                nomeCliente: atualizado.cliente.nome,
              },
              tenantId,
            )
            .catch((err: unknown) =>
              this.logger.error(
                `[Pet Pronto] Falha ao enviar msg de pet pronto: ${String(err)}`,
              ),
            );
        }
      } else {
        // Cliente já está com o pet (ou não informado) — envia avaliação imediatamente
        this.enviarAvaliacaoPendente(id, tenantId).catch((err: unknown) =>
          this.logger.error(
            `[Satisfação] Falha ao disparar avaliação imediata: ${String(err)}`,
          ),
        );
      }
    }

    return atualizado;
  }

  /** Envia a mensagem de avaliação para um agendamento específico */
  async enviarAvaliacaoPendente(
    agendamentoId: string,
    tenantId: string,
  ): Promise<void> {
    const agendamento = await this.prisma.agendamento.findFirst({
      where: { id: agendamentoId, tenantId },
      include: {
        cliente: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefonePrincipal: true,
          },
        },
        pet: { select: { nome: true } },
        servicos: { include: { servico: { select: { nome: true } } } },
      },
    });
    if (!agendamento) return;

    const { cliente, pet, servicos } = agendamento;

    this.logger.log(
      `[Satisfação] Agendamento ${agendamentoId} — e-mail: ${cliente.email ?? 'NÃO CADASTRADO'}`,
    );

    if (!cliente.email && !cliente.telefonePrincipal) return;

    const jaTemAvaliacao = await this.prisma.avaliacaoCliente.findUnique({
      where: { agendamentoId },
    });
    if (jaTemAvaliacao) {
      this.logger.log(
        `[Satisfação] Avaliação já existe para agendamento ${agendamentoId}, pulando envio.`,
      );
      return;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { nome: true, mensagemAvaliacao: true, plano: true },
    });
    const token = await this.avaliacoes.criarPendente(
      agendamentoId,
      cliente.id,
      tenantId,
    );
    const baseUrl = this.config
      .get<string>('FRONTEND_URL', 'https://app.aninpet.com.br')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    const linkAvaliacao = `${baseUrl}/avaliar/${token}`;

    if (cliente.telefonePrincipal && tenant?.plano === 'plus') {
      const template =
        tenant?.mensagemAvaliacao ??
        'Olá, {nome}! 🐾 Esperamos que {pet} tenha adorado o serviço!\n\nPoderia avaliar o atendimento? Leva menos de 1 minuto 😊\n{link}';
      const mensagemWpp = template
        .replaceAll('{nome}', cliente.nome)
        .replaceAll('{pet}', pet.nome)
        .replaceAll('{link}', linkAvaliacao);
      const res = await this.whatsapp
        .enviar(
          {
            telefone: cliente.telefonePrincipal,
            mensagem: mensagemWpp,
            nomeCliente: cliente.nome,
          },
          tenantId,
        )
        .catch(() => ({ sucesso: false }));
      if (!res.sucesso && cliente.email) {
        await this.email
          .enviarPesquisaSatisfacao(
            cliente.email,
            cliente.nome,
            pet.nome,
            servicos[0]?.servico.nome ?? 'Serviço',
            tenant?.nome ?? 'Petshop',
            linkAvaliacao,
          )
          .catch((err: unknown) =>
            this.logger.error(
              `[Satisfação] Falha e-mail fallback: ${String(err)}`,
            ),
          );
      }
    } else if (cliente.email) {
      await this.email
        .enviarPesquisaSatisfacao(
          cliente.email,
          cliente.nome,
          pet.nome,
          servicos[0]?.servico.nome ?? 'Serviço',
          tenant?.nome ?? 'Petshop',
          linkAvaliacao,
        )
        .catch((err: unknown) =>
          this.logger.error(`[Satisfação] Falha e-mail: ${String(err)}`),
        );
    }

    // Limpa o campo para não reprocessar
    await this.prisma.agendamento.update({
      where: { id: agendamentoId },
      data: { avaliacaoAgendarEm: null },
    });
  }

  /** Cron: a cada 5 minutos, envia avaliações cujo horário chegou */
  @Cron('0 */5 * * * *')
  async processarAvaliacoesPendentes() {
    const pendentes = await this.prisma.agendamento.findMany({
      where: {
        avaliacaoAgendarEm: { lte: new Date() },
        status: 'Concluido',
      },
      select: { id: true, tenantId: true },
    });

    for (const ag of pendentes) {
      this.logger.log(`[Cron Avaliação] Processando agendamento ${ag.id}`);
      await this.enviarAvaliacaoPendente(ag.id, ag.tenantId).catch(
        (err: unknown) =>
          this.logger.error(
            `[Cron Avaliação] Erro ao processar ${ag.id}: ${String(err)}`,
          ),
      );
    }
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.agendamento.delete({ where: { id } });
  }

  /** Agendamentos cujo horário já passou e ainda não tiveram ação */
  async findPendentes(tenantId: string) {
    return this.prisma.agendamento.findMany({
      where: {
        tenantId,
        dataHora: { lt: new Date() },
        status: { in: ['Agendado', 'Confirmado'] },
      },
      orderBy: { dataHora: 'asc' },
      include: this.include,
    });
  }

  /** Marca como NaoCompareceu todos os agendamentos passados sem ação (chamado pelo cron global) */
  async marcarNaoCompareceu() {
    return this.prisma.agendamento.updateMany({
      where: {
        dataHora: { lt: new Date() },
        status: { in: ['Agendado', 'Confirmado'] },
      },
      data: { status: 'NaoCompareceu' },
    });
  }
}
