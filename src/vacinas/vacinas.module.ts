import { Module } from '@nestjs/common';
import { VacinasController } from './vacinas.controller';
import { VacinasService } from './vacinas.service';

@Module({
  controllers: [VacinasController],
  providers: [VacinasService],
})
export class VacinasModule {}
