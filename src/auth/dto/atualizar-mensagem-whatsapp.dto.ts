import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AtualizarMensagemWhatsappDto {
  @ApiProperty({
    required: false,
    example:
      'Olá, {nome}! 🐾 Seu agendamento para {pet} foi confirmado.\nServiço: {servico}\nData: {data} às {hora}\nAté lá! 😊',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensagem?: string;

  @ApiProperty({
    required: false,
    example:
      'Olá, {nome}! 🐾 Esperamos que {pet} tenha adorado o serviço!\n\nPoderia avaliar o atendimento? Leva menos de 1 minuto 😊\n{link}',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  mensagemAvaliacao?: string;
}
