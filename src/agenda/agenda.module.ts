import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { AgendaCronService } from './agenda.cron.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [FinanceiroModule, WhatsappModule, AuthModule],
  controllers: [AgendaController],
  providers: [AgendaService, AgendaCronService],
})
export class AgendaModule {}
