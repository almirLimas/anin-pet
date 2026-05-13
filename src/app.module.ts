import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { PetsModule } from './pets/pets.module';
import { ServicosModule } from './servicos/servicos.module';
import { AgendaModule } from './agenda/agenda.module';
import { EstoqueModule } from './estoque/estoque.module';
import { VacinasModule } from './vacinas/vacinas.module';
import { FinanceiroModule } from './financeiro/financeiro.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { PagamentoModule } from './pagamento/pagamento.module';
import { AvaliacoesModule } from './avaliacoes/avaliacoes.module';
import { PdvModule } from './pdv/pdv.module';
import { IaModule } from './ia/ia.module';
import { OrdemServicoModule } from './ordem-servico/ordem-servico.module';
import { FechamentoModule } from './fechamento/fechamento.module';
import { NpsModule } from './nps/nps.module';
import { PacotesModule } from './pacotes/pacotes.module';
import { FornecedoresModule } from './fornecedores/fornecedores.module';
import { CuponsModule } from './cupons/cupons.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    PrismaModule,
    AdminModule,
    AuthModule,
    ClientesModule,
    PetsModule,
    ServicosModule,
    AgendaModule,
    EstoqueModule,
    VacinasModule,
    FinanceiroModule,
    RelatoriosModule,
    WhatsappModule,
    PagamentoModule,
    AvaliacoesModule,
    PdvModule,
    IaModule,
    OrdemServicoModule,
    FechamentoModule,
    NpsModule,
    PacotesModule,
    FornecedoresModule,
    CuponsModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
