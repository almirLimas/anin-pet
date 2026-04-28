import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';

@Injectable()
export class NpsService {
  private readonly logger = new Logger(NpsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Roda todo dia às 10h.
   * Envia NPS para tenants ativos que:
   *  - Criaram conta há 7 dias (primeiro envio)
   *  - Ou completaram 30 dias desde o último feedback enviado
   */
  @Cron(CronExpression.EVERY_DAY_AT_NOON)
  async dispararNPS() {
    const agora = new Date();
    const sete = new Date(agora);
    sete.setDate(sete.getDate() - 7);
    const trinta = new Date(agora);
    trinta.setDate(trinta.getDate() - 30);

    // Tenants ativos com assinatura ativa ou em trial
    const tenants = await this.prisma.tenant.findMany({
      where: {
        assinaturaStatus: { in: ['ativa', 'trial'] },
        OR: [
          // Primeiro envio: 7 dias após criação, nunca enviou NPS
          {
            createdAt: { lte: sete },
            feedbacksNPS: { none: {} },
          },
          // Envios recorrentes: 30 dias após o último NPS enviado
          {
            feedbacksNPS: {
              every: { enviadoEm: { lte: trinta } },
              some: {},
            },
          },
        ],
      },
      include: {
        usuarios: {
          where: { perfil: 'admin', status: 'ativo' },
          select: { email: true, nomeCompleto: true },
          take: 1,
        },
      },
    });

    const frontendUrl = this.config
      .getOrThrow<string>('FRONTEND_URL')
      .split(',')[0]
      .trim()
      .replace(/\/$/, '');

    for (const tenant of tenants) {
      const admin = tenant.usuarios[0];
      if (!admin) continue;

      const token = crypto.randomBytes(24).toString('hex');

      await this.prisma.feedbackNPS.create({
        data: { tenantId: tenant.id, nota: 0, token },
      });

      await this.email.enviarNPS({
        email: admin.email,
        nomeAdmin: admin.nomeCompleto.split(' ')[0] ?? admin.nomeCompleto,
        nomePetshop: tenant.nome,
        linkBase: frontendUrl,
        token,
      });

      this.logger.log(`NPS enviado para tenant ${tenant.id} (${tenant.nome})`);
    }
  }

  async responder(token: string, nota: number, comentario?: string) {
    const feedback = await this.prisma.feedbackNPS.findUnique({
      where: { token },
      include: { tenant: { select: { nome: true } } },
    });

    if (!feedback) throw new NotFoundException('Link de avaliação inválido.');

    // Já respondido — retorna silenciosamente
    if (feedback.respondidoEm) {
      return { jaRespondido: true, nomePetshop: feedback.tenant.nome };
    }

    await this.prisma.feedbackNPS.update({
      where: { token },
      data: { nota, comentario: comentario ?? null, respondidoEm: new Date() },
    });

    // Notifica você por e-mail
    const alertEmail = this.config.get<string>('ALERT_EMAIL');
    if (alertEmail) {
      const emojis = ['', '😞', '😕', '😐', '🙂', '😍'];
      const emoji = emojis[nota] ?? '';
      await this.email['enviar'](
        alertEmail,
        `NPS ${emoji} Nota ${nota}/5 — ${feedback.tenant.nome}`,
        `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
          <h2 style="color:#1d9fb6;">Novo feedback NPS recebido!</h2>
          <table style="width:100%;border-collapse:collapse;margin:16px 0;">
            <tr style="background:#f0fafb;">
              <td style="padding:10px 14px;color:#6b7280;font-size:14px;width:130px;">Petshop</td>
              <td style="padding:10px 14px;font-size:14px;font-weight:bold;">${feedback.tenant.nome}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;color:#6b7280;font-size:14px;">Nota</td>
              <td style="padding:10px 14px;font-size:22px;">${emoji} ${nota}/5</td>
            </tr>
            ${
              comentario
                ? `<tr style="background:#f0fafb;">
                <td style="padding:10px 14px;color:#6b7280;font-size:14px;">Comentário</td>
                <td style="padding:10px 14px;font-size:14px;">${comentario}</td>
              </tr>`
                : ''
            }
          </table>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;"/>
          <p style="color:#9ca3af;font-size:12px;">AninPet — NPS automático</p>
        </div>
      `,
      );
    }

    return { sucesso: true, nomePetshop: feedback.tenant.nome };
  }

  async listar() {
    return this.prisma.feedbackNPS.findMany({
      where: { respondidoEm: { not: null } },
      orderBy: { respondidoEm: 'desc' },
      select: {
        id: true,
        nota: true,
        comentario: true,
        respondidoEm: true,
        tenant: { select: { nome: true } },
      },
    });
  }
}
