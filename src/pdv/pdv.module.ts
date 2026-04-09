import { Module } from '@nestjs/common';
import { PdvController } from './pdv.controller';
import { PdvService } from './pdv.service';

@Module({
  controllers: [PdvController],
  providers: [PdvService],
})
export class PdvModule {}
