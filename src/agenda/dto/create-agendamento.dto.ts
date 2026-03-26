import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadeAgendamento, StatusAgendamento } from '@prisma/client';

export class CreateAgendamentoDto {
  @ApiProperty()
  @IsString()
  clienteId: string;

  @ApiProperty()
  @IsString()
  petId: string;

  @ApiProperty()
  @IsString()
  servicoId: string;

  @ApiProperty({ description: 'ISO 8601 datetime string' })
  @IsString()
  dataHora: string;

  @ApiPropertyOptional({ enum: StatusAgendamento })
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @ApiPropertyOptional({ enum: ModalidadeAgendamento })
  @IsOptional()
  @IsEnum(ModalidadeAgendamento)
  modalidade?: ModalidadeAgendamento;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
