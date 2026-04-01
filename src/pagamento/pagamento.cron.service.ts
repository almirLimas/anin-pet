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
}
