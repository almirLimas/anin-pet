import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePacoteDto {
  @ApiProperty({ example: 'Plano Banho Mensal' })
  @IsString()
  nome: string;

  @ApiPropertyOptional({ example: '4 banhos por mês' })
  @IsOptional()
  @IsString()
  descricao?: string;

  @ApiProperty({ example: 120 })
  @IsNumber()
  @Min(0)
  valor: number;

  @ApiProperty({ example: 4, description: 'Total de sessões incluídas' })
  @IsNumber()
  @Min(1)
  totalSessoes: number;

  @ApiPropertyOptional({ example: 30, description: 'Validade em dias' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  validadeDias?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({
    example: ['clx1', 'clx2'],
    description: 'IDs dos serviços incluídos no pacote',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  servicosIds?: string[];
}
