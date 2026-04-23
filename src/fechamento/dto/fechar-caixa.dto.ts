import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class FecharCaixaDto {
  @ApiProperty({ required: false, example: 'Fechamento do dia' })
  @IsOptional()
  @IsString()
  observacoes?: string;
}
