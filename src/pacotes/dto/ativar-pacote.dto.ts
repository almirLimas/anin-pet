import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsArray,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadeAgendamento } from '@prisma/client';
import { Type } from 'class-transformer';

export class AtivarPacoteDto {
  @ApiProperty({ description: 'ID do pacote a ser ativado' })
  @IsString()
  pacoteId: string;

  @ApiProperty({ description: 'ID do cliente' })
  @IsString()
  clienteId: string;

  @ApiPropertyOptional({ description: 'ID do pet (opcional)' })
  @IsOptional()
  @IsString()
  petId?: string;

  // ── Agendamento automático das sessões ──────────────────────────────────

  @ApiPropertyOptional({
    description: 'Se true, agenda todas as sessões automaticamente',
  })
  @IsOptional()
  @IsBoolean()
  agendarSessoes?: boolean;

  @ApiPropertyOptional({
    description:
      'Dia da semana: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  diaDaSemana?: number;

  @ApiPropertyOptional({
    description: 'Horário no formato HH:MM',
    example: '10:00',
  })
  @IsOptional()
  @IsString()
  hora?: string;

  @ApiPropertyOptional({
    description: 'IDs dos serviços para cada sessão agendada',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicoIds?: string[];

  @ApiPropertyOptional({
    description:
      'Data de início YYYY-MM-DD (padrão: próxima ocorrência do diaDaSemana)',
  })
  @IsOptional()
  @IsString()
  dataInicio?: string;

  @ApiPropertyOptional({ enum: ModalidadeAgendamento })
  @IsOptional()
  @IsEnum(ModalidadeAgendamento)
  modalidade?: ModalidadeAgendamento;
}
