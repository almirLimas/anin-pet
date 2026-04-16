import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UsuarioAtual } from '../common/decorators/usuario-atual.decorator';
import { IaService } from './ia.service';
import { ChatIaDto } from './dto/chat-ia.dto';

@ApiTags('IA')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ia')
export class IaController {
  constructor(private readonly iaService: IaService) {}

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @UseGuards(ThrottlerGuard)
  @Post('chat')
  async chat(
    @UsuarioAtual() usuario: { tenantId: string },
    @Body() dto: ChatIaDto,
  ) {
    return await this.iaService.chat(usuario.tenantId, dto.mensagens);
  }
}
