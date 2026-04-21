import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoLancamento, CategoriaLancamento } from '@prisma/client';

export class CreateLancamentoDto {
  @IsEnum(TipoLancamento)
  tipo: TipoLancamento;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Type(() => Number)
  valor: number;

  @IsNotEmpty()
  @IsString()
  descricao: string;

  @IsEnum(CategoriaLancamento)
  @IsOptional()
  categoria?: CategoriaLancamento;

  @IsOptional()
  @IsString()
  data?: string;

  @IsOptional()
  @IsString()
  agendamentoId?: string;

  @IsOptional()
  @IsString()
  formaPagamento?: string;
}
