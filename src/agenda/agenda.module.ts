import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { AgendaCronService } from './agenda.cron.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';
import { AvaliacoesModule } from '../avaliacoes/avaliacoes.module';

@Module({
  imports: [FinanceiroModule, WhatsappModule, AuthModule, AvaliacoesModule],
  controllers: [AgendaController],
  providers: [AgendaService, AgendaCronService],
})
export class AgendaModule {}
