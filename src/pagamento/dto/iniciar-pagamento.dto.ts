import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Plano } from '@prisma/client';

export class IniciarPagamentoDto {
  @ApiProperty({ enum: Plano })
  @IsEnum(Plano, { message: 'Plano inválido' })
  plano: Plano;

  @ApiProperty({ enum: ['cartao', 'pix'] })
  @IsEnum(['cartao', 'pix'], {
    message: 'Forma de pagamento inválida. Use cartao ou pix',
  })
  formaPagamento: 'cartao' | 'pix';

  @ApiPropertyOptional({
    example: '123.456.789-00',
    description: 'Obrigatório para PIX',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{3}\.?\d{3}\.?\d{3}-?\d{2}$/, { message: 'CPF inválido' })
  cpf?: string;
}
