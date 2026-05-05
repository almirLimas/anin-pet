import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AtivarPacoteDto {
  @ApiProperty({ description: 'ID do pacote a ser ativado' })
  @IsString()
  pacoteId: string;

  @ApiProperty({ description: 'ID do cliente' })
  @IsString()
  clienteId: string;

  @ApiPropertyOptional({ description: 'ID do pet (opcional)' })
  @IsOptional()
  @IsString()
  petId?: string;
}
