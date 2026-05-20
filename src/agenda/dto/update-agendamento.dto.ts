import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateAgendamentoDto } from './create-agendamento.dto';

export class UpdateAgendamentoDto extends PartialType(CreateAgendamentoDto) {
  @IsOptional()
  @IsBoolean()
  clienteJaBuscou?: boolean;
}
