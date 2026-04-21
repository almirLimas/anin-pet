import { Module } from '@nestjs/common';
import { IaController } from './ia.controller';
import { IaService } from './ia.service';
import { ClientesModule } from '../clientes/clientes.module';
import { PetsModule } from '../pets/pets.module';
import { ServicosModule } from '../servicos/servicos.module';
import { EstoqueModule } from '../estoque/estoque.module';
import { AgendaModule } from '../agenda/agenda.module';

@Module({
  imports: [
    ClientesModule,
    PetsModule,
    ServicosModule,
    EstoqueModule,
    AgendaModule,
  ],
  controllers: [IaController],
  providers: [IaService],
})
export class IaModule {}
