import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ClientesModule } from './clientes/clientes.module';
import { PetsModule } from './pets/pets.module';
import { ServicosModule } from './servicos/servicos.module';
import { AgendaModule } from './agenda/agenda.module';
import { EstoqueModule } from './estoque/estoque.module';
import { VacinasModule } from './vacinas/vacinas.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    ClientesModule,
    PetsModule,
    ServicosModule,
    AgendaModule,
    EstoqueModule,
    VacinasModule,
  ],
})
export class AppModule {}
