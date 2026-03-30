import { Module } from '@nestjs/common';
import { WhatsappInstanceManager } from './whatsapp-baileys.service';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsappService, WhatsappInstanceManager],
  exports: [WhatsappService, WhatsappInstanceManager],
})
export class WhatsappModule {}
