import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TipoCupom } from '@prisma/client';

export class CreateCupomDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  codigo: string;

  @ApiProperty({ enum: TipoCupom })
  @IsEnum(TipoCupom)
  tipo: TipoCupom;

  @ApiProperty({ description: 'Valor em R$ (Fixo) ou % (Percentual)' })
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  valor: number;

  @ApiPropertyOptional({ description: 'Null = ilimitado' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  usoMaximo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiraEm?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}
