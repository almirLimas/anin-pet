import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateMovimentacaoDto {
  @ApiProperty()
  @IsString()
  produtoId: string;

  @ApiProperty({ enum: ['Entrada', 'Saida'] })
  @IsEnum(['Entrada', 'Saida'])
  tipo: 'Entrada' | 'Saida';

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  quantidade: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  precoUnitario?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;
}
