import { IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Plano } from '@prisma/client';

export class IniciarPagamentoDto {
  @ApiProperty({ enum: Plano })
  @IsEnum(Plano, { message: 'Plano inválido' })
  plano: Plano;
}
