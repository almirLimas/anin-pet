import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusAgendamento } from '@prisma/client';

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
