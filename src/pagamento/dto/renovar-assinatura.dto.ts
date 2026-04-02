import { IsEnum, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Plano } from '@prisma/client';

export class RenovarAssinaturaDto {
  @ApiPropertyOptional({
    enum: Plano,
    description: 'Troca o plano ao renovar. Omitir mantém o plano atual.',
  })
  @IsOptional()
  @IsEnum(Plano, { message: 'Plano inválido' })
  plano?: Plano;
}
