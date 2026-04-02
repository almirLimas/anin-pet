import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AssinaturaStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PagamentoCronService {
  private readonly logger = new Logger(PagamentoCronService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly config: ConfigService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async verificarTrialsExpirados() {
    const agora = new Date();

    const tenants = await this.prisma.tenant.findMany({
      where: {
        assinaturaStatus: AssinaturaStatus.trial,
        trialExpiraEm: { lte: agora },
      },
      select: {
        id: true,
        nome: true,
        usuarios: {
          select: { email: true, nomeCompleto: true },
          where: { status: 'ativo', perfil: 'admin' },
          take: 1,
        },
      },
    });

    if (tenants.length === 0) {
      this.logger.log('Nenhum trial expirado encontrado.');
      return;
    }

    this.logger.log(`Trials expirados encontrados: ${tenants.length}`);

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const link = `${frontendUrl}/renovar-assinatura`;

    for (const tenant of tenants) {
      await this.prisma.tenant.update({
        where: { id: tenant.id },
        data: { assinaturaStatus: AssinaturaStatus.suspensa },
      });

      const admin = tenant.usuarios[0];
      if (admin) {
        await this.emailService.enviarTrialExpirado(
          admin.email,
          admin.nomeCompleto,
          link,
        );
        this.logger.log(
          `Trial expirado: tenant ${tenant.id} — e-mail enviado para ${admin.email}`,
        );
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async enviarAvisosTrialExpirando() {
    const agora = new Date();
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const link = `${frontendUrl}/configuracoes/assinatura`;

    for (const diasRestantes of [3, 1]) {
      const inicio = new Date(agora);
      inicio.setDate(inicio.getDate() + diasRestantes);
      inicio.setHours(0, 0, 0, 0);

      const fim = new Date(inicio);
      fim.setHours(23, 59, 59, 999);

      const campoAviso =
        diasRestantes === 3 ? 'avisoTrial3dEnviadoEm' : 'avisoTrial1dEnviadoEm';

      const tenants = await this.prisma.tenant.findMany({
        where: {
          assinaturaStatus: AssinaturaStatus.trial,
          trialExpiraEm: { gte: inicio, lte: fim },
          [campoAviso]: null,
        },
        select: {
          id: true,
          usuarios: {
            select: { email: true, nomeCompleto: true },
            where: { status: 'ativo', perfil: 'admin' },
            take: 1,
          },
        },
      });

      if (tenants.length === 0) {
        this.logger.log(
          `Nenhum trial expirando em ${diasRestantes} dia(s) encontrado.`,
        );
        continue;
      }

      this.logger.log(
        `Trials expirando em ${diasRestantes} dia(s): ${tenants.length} tenant(s).`,
      );

      for (const tenant of tenants) {
        const admin = tenant.usuarios[0];
        if (admin) {
          await this.emailService.enviarTrialExpirando(
            admin.email,
            admin.nomeCompleto,
            link,
            diasRestantes,
          );
        }

        await this.prisma.tenant.update({
          where: { id: tenant.id },
          data: { [campoAviso]: agora },
        });

        const destino = admin ? ` → ${admin.email}` : ' (sem admin)';
        this.logger.log(
          `Aviso ${diasRestantes}d enviado: tenant ${tenant.id}${destino}`,
        );
      }
    }
  }
}
