import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, Min } from 'class-validator';

export class AtualizarTaxaBuscaDto {
  @ApiProperty({
    example: 15,
    description:
      'Taxa de busca/transporte (taxidog) em reais. Use 0 para desativar.',
  })
  @IsNumber()
  @Min(0)
  taxaBusca: number;
}
