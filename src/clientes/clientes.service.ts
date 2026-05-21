import {
  Injectable,
  NotFoundException,
  ConflictException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(tenantId: string, page = 1, limit = 20, busca?: string) {
    const skip = (page - 1) * limit;
    const where = busca
      ? {
          tenantId,
          OR: [
            { nome: { contains: busca, mode: 'insensitive' as const } },
            { cpf: { contains: busca } },
            { telefonePrincipal: { contains: busca } },
            { email: { contains: busca, mode: 'insensitive' as const } },
          ],
        }
      : { tenantId };

    const [data, total] = await Promise.all([
      this.prisma.cliente.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nome: 'asc' },
        include: {
          pets: true,
          _count: {
            select: {
              pets: true,
              pacotesAtivos: { where: { status: 'Ativo' } },
            },
          },
        },
      }),
      this.prisma.cliente.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  async findOne(tenantId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
      include: {
        pets: true,
        agendamentos: {
          orderBy: { dataHora: 'desc' },
          take: 10,
          include: { servicos: { include: { servico: true } } },
        },
      },
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    return cliente;
  }

  async create(tenantId: string, dto: CreateClienteDto) {
    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findFirst({
        where: { tenantId, cpf },
      });
      if (existing) throw new ConflictException('CPF já cadastrado');
    }

    const { pets, ...clienteData } = dto;

    return this.prisma.$transaction(async (tx) => {
      const cliente = await tx.cliente.create({
        data: { ...clienteData, cpf, tenantId },
      });

      if (pets && pets.length > 0) {
        await tx.pet.createMany({
          data: pets.map((pet) => ({
            ...pet,
            clienteId: cliente.id,
            tenantId,
          })),
        });
      }

      return tx.cliente.findFirst({
        where: { id: cliente.id },
        include: { pets: true },
      });
    });
  }

  async update(tenantId: string, id: string, dto: UpdateClienteDto) {
    await this.findOne(tenantId, id);

    const cpf = dto.cpf?.trim() || undefined;

    if (cpf) {
      const existing = await this.prisma.cliente.findFirst({
        where: { tenantId, cpf, NOT: { id } },
      });
      if (existing)
        throw new ConflictException('CPF já cadastrado para outro cliente');
    }

    return this.prisma.cliente.update({
      where: { id },
      data: { ...dto, cpf, pets: undefined },
      include: { pets: true },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    return this.prisma.cliente.delete({ where: { id } });
  }

  async pagarMensalidade(tenantId: string, id: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id, tenantId },
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');

    if (!cliente.mensalista) {
      throw new NotFoundException('Cliente não é mensalista');
    }

    const valor = Number(cliente.valorMensal ?? 0);
    if (valor <= 0) {
      throw new NotFoundException(
        'Cliente mensalista sem valor mensal configurado',
      );
    }

    // Verifica se já pagou no mês atual
    if (cliente.ultimaMensalidadePaga) {
      const ultima = new Date(cliente.ultimaMensalidadePaga);
      const agora = new Date();
      if (
        ultima.getFullYear() === agora.getFullYear() &&
        ultima.getMonth() === agora.getMonth()
      ) {
        throw new NotFoundException('Mensalidade deste mês já foi confirmada');
      }
    }

    const agora = new Date();

    return this.prisma.$transaction(async (tx) => {
      await tx.cliente.update({
        where: { id },
        data: { ultimaMensalidadePaga: agora },
      });

      return tx.lancamento.create({
        data: {
          tipo: 'Receita',
          valor,
          descricao: `Mensalidade - ${cliente.nome}`,
          categoria: 'Outro',
          data: agora,
          tenantId,
        },
      });
    });
  }

  async avisosMensalidade(tenantId: string) {
    const hoje = new Date();
    const diaHoje = hoje.getDate();
    const anoHoje = hoje.getFullYear();
    const mesHoje = hoje.getMonth();

    const clientes = await this.prisma.cliente.findMany({
      where: {
        tenantId,
        mensalista: true,
        diaVencimento: diaHoje,
        valorMensal: { gt: 0 },
      },
      select: {
        id: true,
        nome: true,
        valorMensal: true,
        diaVencimento: true,
        ultimaMensalidadePaga: true,
      },
    });

    // Filtra quem ainda não pagou neste mês
    return clientes.filter((c) => {
      if (!c.ultimaMensalidadePaga) return true;
      const ultima = new Date(c.ultimaMensalidadePaga);
      return ultima.getFullYear() !== anoHoje || ultima.getMonth() !== mesHoje;
    });
  }

  async gerarPixMensalidade(tenantId: string, clienteId: string) {
    const cliente = await this.prisma.cliente.findFirst({
      where: { id: clienteId, tenantId },
    });

    if (!cliente) throw new NotFoundException('Cliente não encontrado');
    if (!cliente.mensalista)
      throw new UnprocessableEntityException('Cliente não é mensalista');

    const valor = Number(cliente.valorMensal ?? 0);
    if (valor <= 0)
      throw new UnprocessableEntityException(
        'Cliente mensalista sem valor mensal configurado',
      );

    const accessToken = this.config.getOrThrow<string>('MP_ACCESS_TOKEN');
    const apiUrl = this.config.getOrThrow<string>('BASE_URL');
    const mpClient = new MercadoPagoConfig({ accessToken });

    try {
      const payment = new Payment(mpClient);
      const result = await payment.create({
        body: {
          transaction_amount: valor,
          payment_method_id: 'pix',
          description: `Mensalidade - ${cliente.nome}`,
          date_of_expiration: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          payer: {
            email: cliente.email ?? `cliente-${cliente.id}@noreply.aninpet.com`,
            ...(cliente.cpf && {
              identification: {
                type: 'CPF',
                number: cliente.cpf.replaceAll(/\D/g, ''),
              },
            }),
          },
          external_reference: `mensalidade:${clienteId}`,
          notification_url: `${apiUrl}/pagamento/webhook`,
        },
      });

      const txData = result.point_of_interaction?.transaction_data;

      return {
        qrCode: txData?.qr_code ?? '',
        qrCodeBase64: txData?.qr_code_base64 ?? '',
        valor,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Erro ao gerar PIX: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
    }
  }
}
