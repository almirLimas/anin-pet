import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CategoriaServico, PorteServico } from '@prisma/client';

export class CreateServicoDto {
  @ApiProperty()
  @IsString()
  nome: string;

  @ApiProperty({ enum: CategoriaServico })
  @IsEnum(CategoriaServico)
  categoria: CategoriaServico;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  preco: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  duracaoMinutos?: number;

  @ApiPropertyOptional({ enum: PorteServico })
  @IsOptional()
  @IsEnum(PorteServico)
  porte?: PorteServico;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  ativo?: boolean;
}
