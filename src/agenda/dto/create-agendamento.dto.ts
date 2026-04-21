import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ModalidadeAgendamento, StatusAgendamento } from '@prisma/client';
import { Type } from 'class-transformer';

export class CreateAgendamentoDto {
  @ApiProperty()
  @IsString()
  clienteId!: string;

  @ApiProperty()
  @IsString()
  petId!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  servicoIds!: string[];

  @ApiProperty({ description: 'ISO 8601 datetime string' })
  @IsString()
  dataHora!: string;

  @ApiPropertyOptional({ enum: StatusAgendamento })
  @IsOptional()
  @IsEnum(StatusAgendamento)
  status?: StatusAgendamento;

  @ApiPropertyOptional({ enum: ModalidadeAgendamento })
  @IsOptional()
  @IsEnum(ModalidadeAgendamento)
  modalidade?: ModalidadeAgendamento;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  observacoes?: string;

  @ApiPropertyOptional({
    description: 'Taxa de busca/transporte (taxidog) em reais',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  taxaBusca?: number;

  @ApiPropertyOptional({
    description: 'Endereço de busca quando o petshop vai retirar o pet',
  })
  @IsOptional()
  @IsString()
  enderecoBusca?: string;

  @ApiPropertyOptional({
    description:
      'Forma de pagamento ao concluir (Dinheiro, Pix, Cartao_Debito, Cartao_Credito)',
  })
  @IsOptional()
  @IsString()
  formaPagamento?: string;
}
