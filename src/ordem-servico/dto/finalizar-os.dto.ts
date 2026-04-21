import { IsEnum, IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { FormaPagamento } from '@prisma/client';

export class FinalizarOsDto {
  @IsOptional()
  @IsEnum(FormaPagamento)
  formaPagamento?: FormaPagamento;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  desconto?: number;

  @IsOptional()
  @IsString()
  observacoes?: string;
}
