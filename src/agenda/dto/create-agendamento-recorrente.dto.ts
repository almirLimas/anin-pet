import {
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadeAgendamento } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateAgendamentoRecorrenteDto {
  @ApiProperty()
  @IsString()
  clienteId!: string;

  @ApiProperty()
  @IsString()
  petId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  servicoIds!: string[];

  @ApiProperty({
    description:
      'Dia da semana: 0=Dom, 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab',
  })
  @IsInt()
  @Min(0)
  @Max(6)
  @Type(() => Number)
  diaDaSemana!: number;

  @ApiProperty({ description: 'Hora no formato HH:MM', example: '14:00' })
  @IsString()
  hora!: string;

  @ApiPropertyOptional({
    description:
      'Data de início YYYY-MM-DD. Padrão: próxima ocorrência do diaDaSemana',
  })
  @IsOptional()
  @IsString()
  dataInicio?: string;

  @ApiPropertyOptional({
    description: 'Quantidade de semanas (ocorrências). Padrão: 4',
    minimum: 1,
    maximum: 52,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(52)
  @Type(() => Number)
  quantidadeSemanas?: number;

  @ApiPropertyOptional({ enum: ModalidadeAgendamento })
  @IsOptional()
  @IsEnum(ModalidadeAgendamento)
  modalidade?: ModalidadeAgendamento;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxaBusca?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  enderecoBusca?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
