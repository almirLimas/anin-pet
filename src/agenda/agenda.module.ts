import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { AgendaCronService } from './agenda.cron.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';

@Module({
  imports: [FinanceiroModule],
  controllers: [AgendaController],
  providers: [AgendaService, AgendaCronService],
})
export class AgendaModule {}
