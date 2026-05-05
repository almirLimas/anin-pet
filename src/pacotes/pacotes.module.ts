import { Module } from '@nestjs/common';
import { PacotesController } from './pacotes.controller';
import { PacotesService } from './pacotes.service';
import { PacotesCronService } from './pacotes.cron.service';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [WhatsappModule],
  controllers: [PacotesController],
  providers: [PacotesService, PacotesCronService],
  exports: [PacotesService],
})
export class PacotesModule {}
