import { Module } from '@nestjs/common';
import { OrdemServicoController } from './ordem-servico.controller';
import { OrdemServicoService } from './ordem-servico.service';
import { FinanceiroModule } from '../financeiro/financeiro.module';
import { EstoqueModule } from '../estoque/estoque.module';
import { AgendaModule } from '../agenda/agenda.module';

@Module({
  imports: [FinanceiroModule, EstoqueModule, AgendaModule],
  controllers: [OrdemServicoController],
  providers: [OrdemServicoService],
})
export class OrdemServicoModule {}
