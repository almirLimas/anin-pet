import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AssinaturaStatus, Plano } from '@prisma/client';
import * as crypto from 'node:crypto';
import { MercadoPagoConfig, Payment, PreApproval } from 'mercadopago';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { IniciarPagamentoDto } from './dto/iniciar-pagamento.dto';

const PRECO_PLANO: Record<Plano, number> = {
  basico: 59.0,
  plus: 99.0,
  profissional: 99.0,
  completo: 99.0,
};

const NOME_PLANO: Record<Plano, string> = {
  basico: 'Petshop Básico',
  plus: 'Petshop Plus',
  profissional: 'Petshop Plus',
  completo: 'Petshop Plus',
};

@Injectable()
export class PagamentoService {
  private readonly logger = new Logger(PagamentoService.name);
  private _mpClient: MercadoPagoConfig | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private get mpClient(): MercadoPagoConfig {
    const accessToken = this.config.getOrThrow<string>('MP_ACCESS_TOKEN');
    this._mpClient ??= new MercadoPagoConfig({ accessToken });
    return this._mpClient;
  }

  async iniciarPagamento(
    dto: IniciarPagamentoDto,
    tenantId: string,
    email: string,
  ) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { assinaturaStatus: true, trialExpiraEm: true, plano: true },
    });

    if (tenant.assinaturaStatus === 'ativa') {
      throw new UnprocessableEntityException(
        'Este tenant já possui uma assinatura ativa',
      );
    }

    // If still within the trial period, don't create a payment — just confirm trial
    if (
      tenant.assinaturaStatus === 'trial' &&
      tenant.trialExpiraEm &&
      tenant.trialExpiraEm > new Date()
    ) {
      return {
        tipo: 'trial' as const,
        trialExpiraEm: tenant.trialExpiraEm.toISOString(),
      };
    }

    // Update the plan if a different one was selected
    if (dto.plano && dto.plano !== tenant.plano) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plano: dto.plano },
      });
    }

    return this.criarPreApproval(dto.plano, tenantId, email);
  }

  async trocarPlano(tenantId: string, plano: Plano) {
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plano },
    });
    return { plano };
  }

  async cancelarAssinatura(tenantId: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { assinaturaStatus: true, mpAssinaturaId: true },
    });

    if (tenant.assinaturaStatus === 'cancelada') {
      throw new UnprocessableEntityException('Assinatura já está cancelada');
    }

    // Cancela no Mercado Pago para interromper as cobranças recorrentes
    if (tenant.mpAssinaturaId) {
      try {
        await new PreApproval(this.mpClient).update({
          id: tenant.mpAssinaturaId,
          body: { status: 'cancelled' } as any,
        });
      } catch (err) {
        this.logger.error('Erro ao cancelar PreApproval no Mercado Pago', err);
        throw new InternalServerErrorException(
          'Não foi possível cancelar a assinatura no Mercado Pago. Tente novamente.',
        );
      }
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { assinaturaStatus: AssinaturaStatus.cancelada },
    });

    return { cancelada: true };
  }

  async renovarAssinatura(tenantId: string, plano?: Plano) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        plano: true,
        assinaturaStatus: true,
        usuarios: { select: { email: true }, take: 1 },
      },
    });

    if (tenant.assinaturaStatus === 'ativa') {
      throw new UnprocessableEntityException(
        'Este tenant já possui uma assinatura ativa',
      );
    }

    const planoEfetivo = plano ?? tenant.plano;

    if (planoEfetivo !== tenant.plano) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { plano: planoEfetivo },
      });
    }

    const email = tenant.usuarios[0]?.email ?? '';
    return this.criarPreApproval(planoEfetivo, tenantId, email);
  }

  private async criarPreApproval(
    plano: Plano,
    tenantId: string,
    email: string,
  ) {
    const preco = PRECO_PLANO[plano];
    const nome = NOME_PLANO[plano];
    const frontendUrl = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');
    // MP requires a publicly accessible URL — use MP_BACK_URL if set,
    // otherwise fall back to production URL when running locally
    const backUrl = (
      this.config.get<string>('MP_BACK_URL') ??
      (frontendUrl.includes('localhost')
        ? 'https://app.aninpet.com.br'
        : frontendUrl)
    ).replace(/\/$/, '');
    const apiUrl = this.config.getOrThrow<string>('BASE_URL');

    try {
      const preApproval = new PreApproval(this.mpClient);
      const result = await preApproval.create({
        body: {
          reason: `${nome} - Anin Pet`,
          external_reference: tenantId,
          payer_email: email,
          auto_recurring: {
            frequency: 1,
            frequency_type: 'months',
            transaction_amount: preco,
            currency_id: 'BRL',
            free_trial: {
              frequency: 14,
              frequency_type: 'days',
            },
          },
          back_url: `${backUrl}/renovar-assinatura/sucesso`,
          notification_url: `${apiUrl}/pagamento/webhook`,
          status: 'pending',
        } as any,
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
      this.logger.error(
        'Erro ao criar assinatura recorrente no Mercado Pago',
        err,
      );
      throw new InternalServerErrorException(
        `Erro ao criar assinatura: ${
          err instanceof Error ? err.message : JSON.stringify(err)
        }`,
      );
    }
  }

  async gerarPixMensal(tenantId: string, email: string) {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: { plano: true },
    });
    const valor = PRECO_PLANO[tenant.plano];
    const nome = NOME_PLANO[tenant.plano];
    const apiUrl = this.config.getOrThrow<string>('BASE_URL');

    try {
      const payment = new Payment(this.mpClient);
      const result = await payment.create({
        body: {
          transaction_amount: valor,
          payment_method_id: 'pix',
          description: `Mensalidade ${nome} - Anin Pet`,
          date_of_expiration: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          payer: { email },
          external_reference: `mensal:${tenantId}`,
          notification_url: `${apiUrl}/pagamento/webhook`,
        },
      });

      const txData = result.point_of_interaction?.transaction_data;
      return {
        qrCode: txData?.qr_code ?? '',
        qrCodeBase64: txData?.qr_code_base64 ?? '',
        valor,
        plano: tenant.plano,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (err) {
      this.logger.error('Erro ao gerar PIX mensal', err);
      throw new InternalServerErrorException(
        `Erro ao gerar PIX: ${
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

    if (data.type === 'subscription_preapproval' && data.data?.id) {
      await this.processarPreApproval(String(data.data.id));
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

    const externalRef = result.external_reference;
    if (!externalRef) return;

    // PIX mensal da plataforma: external_reference = "mensal:{tenantId}"
    if (externalRef.startsWith('mensal:')) {
      const tenantId = externalRef.slice('mensal:'.length);
      if (!tenantId) return;

      if (result.status === 'approved') {
        const expiraEm = new Date();
        expiraEm.setMonth(expiraEm.getMonth() + 1);

        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            assinaturaStatus: AssinaturaStatus.ativa,
            avisoPixAte: null,
            trialExpiraEm: expiraEm,
          },
        });
        this.logger.log(
          `PIX mensal aprovado: tenant ${tenantId} → ativa até ${expiraEm.toISOString()}`,
        );
      } else {
        this.logger.log(
          `PIX mensal não aprovado (${result.status}): tenant ${tenantId}`,
        );
      }
      return;
    }

    // Pagamento de mensalidade de cliente do petshop: external_reference = "mensalidade:{clienteId}"
    if (externalRef.startsWith('mensalidade:')) {
      this.logger.log(
        `Pagamento de cliente recebido (${result.status}): ${externalRef}`,
      );
      return;
    }

    // PIX anual ou outros pagamentos diretos: external_reference = tenantId
    const tenantId = externalRef;
    const status =
      result.status === 'approved'
        ? AssinaturaStatus.ativa
        : AssinaturaStatus.suspensa;

    const orderId = result.order?.id ? String(result.order.id) : null;

    await this.prisma.tenant.updateMany({
      where: {
        id: tenantId,
        OR: [
          { mpPagamentoId: paymentId },
          ...(orderId ? [{ mpAssinaturaId: orderId }] : []),
        ],
      },
      data: { assinaturaStatus: status },
    });

    this.logger.log(`Pagamento ${paymentId}: ${status} (tenant ${tenantId})`);
  }

  private async processarPreApproval(preApprovalId: string) {
    try {
      const preApproval = new PreApproval(this.mpClient);
      const result = await preApproval.get({ id: preApprovalId });

      const tenantId = result.external_reference;
      if (!tenantId) return;

      // authorized = assinante autorizou e 1ª cobrança foi aprovada
      // cancelled / paused = cancelou ou suspenso
      let status: AssinaturaStatus;
      switch (result.status) {
        case 'authorized':
          status = AssinaturaStatus.ativa;
          break;
        case 'paused':
          status = AssinaturaStatus.suspensa;
          break;
        case 'cancelled':
          status = AssinaturaStatus.cancelada;
          break;
        default:
          status = AssinaturaStatus.pendente;
      }

      await this.prisma.tenant.updateMany({
        where: { id: tenantId },
        data: {
          assinaturaStatus: status,
          mpAssinaturaId: preApprovalId,
        },
      });

      this.logger.log(
        `PreApproval ${preApprovalId}: ${result.status} → ${status} (tenant ${tenantId})`,
      );
    } catch (err) {
      this.logger.error(`Erro ao processar PreApproval ${preApprovalId}`, err);
    }
  }

  async obterStatus(tenantId: string) {
    return this.prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
      select: {
        assinaturaStatus: true,
        trialExpiraEm: true,
        plano: true,
        mpAssinaturaId: true,
      },
    });
  }
}
