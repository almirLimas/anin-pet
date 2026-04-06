import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsPositive } from 'class-validator';

export class AtualizarMetaDto {
  @ApiProperty({ example: 8000 })
  @IsNumber()
  @IsPositive()
  metaMensal: number;
}
