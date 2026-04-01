import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { PagamentoController } from './pagamento.controller';
import { PagamentoService } from './pagamento.service';
import { PagamentoCronService } from './pagamento.cron.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PagamentoController],
  providers: [PagamentoService, PagamentoCronService],
  exports: [PagamentoService],
})
export class PagamentoModule {}
