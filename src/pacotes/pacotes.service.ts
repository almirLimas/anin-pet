import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { CreatePacoteDto } from './dto/create-pacote.dto';
import { UpdatePacoteDto } from './dto/update-pacote.dto';
import { AtivarPacoteDto } from './dto/ativar-pacote.dto';

@Injectable()
export class PacotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsappService,
  ) {}

  // ── Gestão de pacotes (templates) ────────────────────────────────────────

  findAll(tenantId: string, apenasAtivos = false) {
    return this.prisma.pacoteServico.findMany({
      where: { tenantId, ...(apenasAtivos && { ativo: true }) },
      orderBy: { createdAt: 'desc' },
      include: {
        servicos: { select: { id: true, nome: true, categoria: true } },
      },
    });
  }

  async findOne(tenantId: string, id: string) {
    const pacote = await this.prisma.pacoteServico.findFirst({
      where: { id, tenantId },
      include: {
        servicos: { select: { id: true, nome: true, categoria: true } },
      },
    });
    if (!pacote) throw new NotFoundException('Pacote não encontrado');
    return pacote;
  }

  create(tenantId: string, dto: CreatePacoteDto) {
    const { servicosIds, ...rest } = dto;
    return this.prisma.pacoteServico.create({
      data: {
        ...rest,
        validadeDias: dto.validadeDias ?? 30,
        tenantId,
        ...(servicosIds?.length && {
          servicos: { connect: servicosIds.map((id) => ({ id })) },
        }),
      },
      include: {
        servicos: { select: { id: true, nome: true, categoria: true } },
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdatePacoteDto) {
    await this.findOne(tenantId, id);
    const { servicosIds, ...rest } = dto;
    return this.prisma.pacoteServico.update({
      where: { id },
      data: {
        ...rest,
        ...(servicosIds !== undefined && {
          servicos: {
            set: servicosIds.map((sid) => ({ id: sid })),
          },
        }),
      },
      include: {
        servicos: { select: { id: true, nome: true, categoria: true } },
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    const emUso = await this.prisma.pacoteClienteAtivo.count({
      where: { pacoteId: id, status: 'Ativo' },
    });
    if (emUso > 0)
      throw new BadRequestException(
        'Não é possível excluir: há clientes com este pacote ativo.',
      );
    return this.prisma.pacoteServico.delete({ where: { id } });
  }

  // ── Ativação e uso de pacotes por cliente ────────────────────────────────

  async ativar(tenantId: string, dto: AtivarPacoteDto) {
    const pacote = await this.findOne(tenantId, dto.pacoteId);

    const jaAtivo = await this.prisma.pacoteClienteAtivo.findFirst({
      where: {
        tenantId,
        clienteId: dto.clienteId,
        pacoteId: dto.pacoteId,
        status: 'Ativo',
      },
    });
    if (jaAtivo)
      throw new BadRequestException(
        'Este cliente já possui este pacote ativo.',
      );

    const expiraEm = new Date();
    expiraEm.setDate(expiraEm.getDate() + pacote.validadeDias);

    return this.prisma.pacoteClienteAtivo.create({
      data: {
        pacoteId: dto.pacoteId,
        clienteId: dto.clienteId,
        petId: dto.petId ?? null,
        tenantId,
        totalSessoes: pacote.totalSessoes,
        valor: pacote.valor,
        expiraEm,
      },
      include: {
        pacote: true,
        cliente: { select: { nome: true } },
        pet: { select: { nome: true } },
      },
    });
  }

  async registrarUso(tenantId: string, pacoteClienteId: string) {
    const registro = await this.prisma.pacoteClienteAtivo.findFirst({
      where: { id: pacoteClienteId, tenantId },
    });
    if (!registro)
      throw new NotFoundException('Registro de pacote não encontrado');
    if (registro.status !== 'Ativo')
      throw new BadRequestException('Este pacote não está ativo');
    if (registro.sessoesUsadas >= registro.totalSessoes)
      throw new BadRequestException(
        'Todas as sessões deste pacote já foram utilizadas',
      );

    const novoTotal = registro.sessoesUsadas + 1;
    const esgotado = novoTotal >= registro.totalSessoes;

    return this.prisma.pacoteClienteAtivo.update({
      where: { id: pacoteClienteId },
      data: {
        sessoesUsadas: novoTotal,
        ...(esgotado && { status: 'Expirado' }),
      },
    });
  }

  async cancelar(tenantId: string, pacoteClienteId: string) {
    const registro = await this.prisma.pacoteClienteAtivo.findFirst({
      where: { id: pacoteClienteId, tenantId },
    });
    if (!registro)
      throw new NotFoundException('Registro de pacote não encontrado');

    return this.prisma.pacoteClienteAtivo.update({
      where: { id: pacoteClienteId },
      data: { status: 'Cancelado' },
    });
  }

  async enviarWhatsapp(tenantId: string, pacoteId: string, clienteId: string) {
    const [pacote, cliente] = await Promise.all([
      this.findOne(tenantId, pacoteId),
      this.prisma.cliente.findFirst({
        where: { id: clienteId, tenantId },
        select: { nome: true, telefonePrincipal: true },
      }),
    ]);

    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    if (!cliente.telefonePrincipal)
      throw new BadRequestException(
        'Este cliente não possui telefone cadastrado.',
      );

    const valor = Number(pacote.valor).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    });

    const servicosNomes = pacote.servicos?.map((s) => `• ${s.nome}`).join('\n');
    const servicos = servicosNomes
      ? `\n\nServiços incluídos:\n${servicosNomes}`
      : '';

    const mensagem =
      `Olá, ${cliente.nome.split(' ')[0]}! 🐾\n\n` +
      `Temos uma oferta especial para você: *${pacote.nome}*\n\n` +
      `✅ ${pacote.totalSessoes} sessões por ${valor}` +
      (pacote.descricao ? `\n📝 ${pacote.descricao}` : '') +
      servicos +
      `\n\n📅 Validade: ${pacote.validadeDias} dias após a contratação\n\n` +
      `Aproveite e entre em contato para contratar! 😊`;

    return this.whatsapp.enviar(
      {
        telefone: cliente.telefonePrincipal,
        mensagem,
        nomeCliente: cliente.nome,
      },
      tenantId,
    );
  }

  findPacotesCliente(tenantId: string, clienteId: string) {
    return this.prisma.pacoteClienteAtivo.findMany({
      where: { tenantId, clienteId },
      orderBy: { createdAt: 'desc' },
      include: {
        pacote: { include: { servicos: { select: { id: true, nome: true } } } },
        pet: { select: { nome: true } },
      },
    });
  }

  findTodosPacotesAtivos(tenantId: string) {
    return this.prisma.pacoteClienteAtivo.findMany({
      where: { tenantId, status: 'Ativo' },
      orderBy: { expiraEm: 'asc' },
      include: {
        pacote: { select: { nome: true } },
        cliente: { select: { nome: true, telefonePrincipal: true } },
        pet: { select: { nome: true } },
      },
    });
  }
}
