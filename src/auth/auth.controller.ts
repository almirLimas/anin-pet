import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { LoginDto } from './dto/login.dto';
import { RegistrarDto } from './dto/registrar.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login com e-mail e senha' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('registrar')
  @ApiOperation({ summary: 'Criar novo usuário' })
  registrar(@Body() dto: RegistrarDto) {
    return this.authService.registrar(dto);
  }

  @Get('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna dados do usuário logado' })
  perfil(@Request() req: { user: { id: string } }) {
    return this.authService.perfil(req.user.id);
  }

  @Patch('perfil')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualiza nome, telefone ou senha do usuário logado',
  })
  atualizarPerfil(
    @Request() req: { user: { id: string } },
    @Body() dto: AtualizarPerfilDto,
  ) {
    return this.authService.atualizarPerfil(req.user.id, dto);
  }
}
