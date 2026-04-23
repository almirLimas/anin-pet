import { Module } from '@nestjs/common';
import { FechamentoController } from './fechamento.controller';
import { FechamentoService } from './fechamento.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [FechamentoController],
  providers: [FechamentoService],
})
export class FechamentoModule {}
