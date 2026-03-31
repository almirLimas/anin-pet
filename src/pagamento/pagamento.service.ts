import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssinaturaStatus, Plano } from '@prisma/client';
import * as crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, Preference } from 'mercadopago';
import { PrismaService } from '../prisma/prisma.service';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';

const PRECO_PLANO: Record<Plano, number> = {
  basico: 89,
  profissional: 139,
  completo: 199,
};

const NOME_PLANO: Record<Plano, string> = {
  basico: 'Petshop Básico',
  profissional: 'Petshop + Estoque',
  completo: 'Completo',
};

@Injectable()
export class PagamentoService {
  private readonly logger = new Logger(PagamentoService.name);
  private _mpClient: MercadoPagoConfig | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get mpClient(): MercadoPagoConfig {
    const accessToken = this.config.getOrThrow<string>('MP_ACCESS_TOKEN');
    if (!this._mpClient) {
      this._mpClient = new MercadoPagoConfig({ accessToken });
    }
    return this._mpClient;
  }

  async iniciarPagamento(
    dto: IniciarPagamentoDto,
    tenantId: string,
    email: string,
  ) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { assinaturaStatus: true },
    });

    if (tenant.assinaturaStatus === 'ativa') {
      throw new UnprocessableEntityException(
        'Este tenant já possui uma assinatura ativa',
      );
    }

    if (dto.formaPagamento === 'cartao') {
      return this.criarAssinatura(dto.plano, tenantId);
    }

    if (!dto.cpf) {
      throw new BadRequestException('CPF é obrigatório para pagamento via PIX');
    }
    return this.criarPix(dto.plano, tenantId, email, dto.cpf);
  }

  private async criarAssinatura(plano: Plano, tenantId: string) {
    const preco = PRECO_PLANO[plano];
    const nome = NOME_PLANO[plano];
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    try {
      const preference = new Preference(this.mpClient);
      const result = await preference.create({
        body: {
          items: [
            {
              id: `plano-${plano}`,
              title: `${nome} - Anin Pet`,
              quantity: 1,
              unit_price: preco,
              currency_id: 'BRL',
            },
          ],
          external_reference: tenantId,
          back_urls: {
            success: `${frontendUrl}/criar-conta/sucesso`,
            failure: `${frontendUrl}/criar-conta/pagamento-falhou`,
            pending: `${frontendUrl}/criar-conta/sucesso`,
          },
        },
      });

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          mpAssinaturaId: result.id,
          assinaturaStatus: AssinaturaStatus.pendente,
        },
      });

      return { tipo: 'checkout' as const, url: result.init_point! };
    } catch (err) {
      this.logger.error('Erro ao criar preferência no Mercado Pago', err);
      throw new InternalServerErrorException(
        `Erro ao criar assinatura: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
    }
  }

  private async criarPix(
    plano: Plano,
    tenantId: string,
    email: string,
    cpf: string,
  ) {
    const precoMensal = PRECO_PLANO[plano];
    const valor = Number((precoMensal * 12 * 0.8).toFixed(2));
    const nome = NOME_PLANO[plano];
    const apiUrl = this.config.getOrThrow<string>('BASE_URL');

    try {
      const payment = new Payment(this.mpClient);
      const result = await payment.create({
        body: {
          transaction_amount: valor,
          payment_method_id: 'pix',
          description: `Plano Anual ${nome} - Anin Pet`,
          payer: {
            email,
            identification: {
              type: 'CPF',
              number: cpf.replaceAll(/\D/g, ''),
            },
          },
          external_reference: tenantId,
          notification_url: `${apiUrl}/pagamento/webhook`,
        },
      });

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          mpPagamentoId: String(result.id),
          assinaturaStatus: AssinaturaStatus.pendente,
          trialExpiraEm: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        },
      });

      const txData = result.point_of_interaction?.transaction_data;

      return {
        tipo: 'pix' as const,
        qrCode: txData?.qr_code ?? '',
        qrCodeBase64: txData?.qr_code_base64 ?? '',
        valor,
      };
    } catch (err) {
      this.logger.error('Erro ao criar pagamento PIX no Mercado Pago', err);
      throw new InternalServerErrorException(
        `Erro ao criar PIX: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
    }
  }

  async processarWebhook(headers: Record<string, string>, body: unknown) {
    const webhookSecret = this.config.get<string>('MP_WEBHOOK_SECRET');
    if (webhookSecret) {
      try {
        this.validarAssinatura(headers, body, webhookSecret);
      } catch (err) {
        this.logger.warn('Assinatura de webhook inválida', err);
        return;
      }
    }

    const data = body as {
      type?: string;
      data?: { id?: string | number };
    };

    this.logger.log(`Webhook recebido: type=${data.type}, id=${data.data?.id}`);

    if (data.type === 'payment' && data.data?.id) {
      await this.processarPagamento(String(data.data.id));
    }
  }

  private validarAssinatura(
    headers: Record<string, string>,
    body: unknown,
    secret: string,
  ) {
    const signature = headers['x-signature'] ?? '';
    const requestId = headers['x-request-id'] ?? '';
    const dataId = (body as { data?: { id?: string } })?.data?.id ?? '';

    const parts = Object.fromEntries(
      signature.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k, v] as [string, string];
      }),
    );
    const ts = parts['ts'] ?? '';
    const v1 = parts['v1'] ?? '';

    const template = `id:${dataId};request-id:${requestId};ts:${ts};`;
    const hash = crypto
      .createHmac('sha256', secret)
      .update(template)
      .digest('hex');

    if (hash !== v1) {
      throw new Error('Assinatura do webhook inválida');
    }
  }

  private async processarPagamento(paymentId: string) {
    const payment = new Payment(this.mpClient);
    const result = await payment.get({ id: paymentId });

    const tenantId = result.external_reference;
    if (!tenantId) return;

    const status =
      result.status === 'approved'
        ? AssinaturaStatus.ativa
        : AssinaturaStatus.suspensa;

    await this.prisma.tenant.updateMany({
      where: { mpPagamentoId: paymentId },
      data: { assinaturaStatus: status },
    });

    this.logger.log(`Pagamento PIX ${paymentId}: ${status}`);
  }

  async obterStatus(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        assinaturaStatus: true,
        trialExpiraEm: true,
        plano: true,
      },
    });
  }
}
