import { Module } from '@nestjs/common';
import { AgendaController } from './agenda.controller';
import { AgendaService } from './agenda.service';
import { AgendaCronService } from './agenda.cron.service';

@Module({
  controllers: [AgendaController],
  providers: [AgendaService, AgendaCronService],
})
export class AgendaModule {}
