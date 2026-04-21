import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { TipoItemVenda } from '@prisma/client';

export class AddItemOsDto {
  @IsEnum(TipoItemVenda)
  tipo: TipoItemVenda;

  @IsString()
  nome: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  quantidade: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario: number;

  @IsOptional()
  @IsString()
  produtoId?: string;

  @IsOptional()
  @IsString()
  servicoId?: string;
}
