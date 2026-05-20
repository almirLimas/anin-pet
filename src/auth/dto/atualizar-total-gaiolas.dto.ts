import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max } from 'class-validator';

export class AtualizarTotalGaiolasDto {
  @ApiProperty({
    example: 10,
    description: 'Número total de gaiolas do petshop (1–100).',
  })
  @IsInt()
  @Min(1)
  @Max(100)
  totalGaiolas: number;
}
