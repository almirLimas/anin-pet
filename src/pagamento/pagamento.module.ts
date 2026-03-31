import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PagamentoController } from './pagamento.controller';
import { PagamentoService } from './pagamento.service';

@Module({
  imports: [PrismaModule],
  controllers: [PagamentoController],
  providers: [PagamentoService],
  exports: [PagamentoService],
})
export class PagamentoModule {}
