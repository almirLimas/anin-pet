import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { AtualizarMetaDto } from './dto/atualizar-meta.dto';
import { AtualizarTaxaBuscaDto } from './dto/atualizar-taxa-busca.dto';
import { AtualizarTotalGaiolasDto } from './dto/atualizar-total-gaiolas.dto';
import { CriarStaffDto } from './dto/criar-staff.dto';
import { AtualizarStaffDto } from './dto/atualizar-staff.dto';
import { AtualizarMensagemWhatsappDto } from './dto/atualizar-mensagem-whatsapp.dto';
import { EsqueceuSenhaDto } from './dto/esqueceu-senha.dto';
import { LoginDto } from './dto/login.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
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

  @Get('onboarding-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna status dos passos de onboarding' })
  onboardingStatus(@Request() req: { user: { id: string } }) {
    return this.authService.onboardingStatus(req.user.id);
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

  @Patch('meta')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza a meta mensal de receita do petshop' })
  atualizarMeta(
    @Request() req: { user: { id: string } },
    @Body() dto: AtualizarMetaDto,
  ) {
    return this.authService.atualizarMeta(req.user.id, dto);
  }

  @Patch('taxa-busca')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza a taxa de busca/taxidog do petshop' })
  atualizarTaxaBusca(
    @Request() req: { user: { id: string } },
    @Body() dto: AtualizarTaxaBuscaDto,
  ) {
    return this.authService.atualizarTaxaBusca(req.user.id, dto);
  }

  @Patch('total-gaiolas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualiza o número total de gaiolas do petshop' })
  atualizarTotalGaiolas(
    @Request() req: { user: { id: string } },
    @Body() dto: AtualizarTotalGaiolasDto,
  ) {
    return this.authService.atualizarTotalGaiolas(req.user.id, dto);
  }

  @Post('esqueceu-senha')
  @ApiOperation({ summary: 'Solicita link de redefinição de senha por e-mail' })
  solicitarReset(@Body() dto: EsqueceuSenhaDto) {
    return this.authService.solicitarResetSenha(dto);
  }

  @Post('redefinir-senha')
  @ApiOperation({
    summary: 'Redefine a senha usando o token recebido por e-mail',
  })
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto);
  }

  @Get('verificar-email')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verifica se um e-mail já está em uso' })
  verificarEmail(@Query('email') email: string) {
    return this.authService.verificarEmail(email);
  }

  @Post('staff')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Cadastra um funcionário no petshop (máx. 3 básico / 5 plus). Apenas admin.',
  })
  criarStaff(
    @Request() req: { user: { id: string } },
    @Body() dto: CriarStaffDto,
  ) {
    return this.authService.criarStaff(req.user.id, dto);
  }

  @Get('staff')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Lista os funcionários do petshop. Apenas admin.' })
  listarStaff(@Request() req: { user: { id: string } }) {
    return this.authService.listarStaff(req.user.id);
  }

  @Patch('staff/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualiza um funcionário do petshop. Apenas admin.',
  })
  atualizarStaff(
    @Request() req: { user: { id: string } },
    @Param('id') staffId: string,
    @Body() dto: AtualizarStaffDto,
  ) {
    return this.authService.atualizarStaff(req.user.id, staffId, dto);
  }

  @Delete('staff/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remove um funcionário do petshop. Apenas admin.' })
  removerStaff(
    @Request() req: { user: { id: string } },
    @Param('id') staffId: string,
  ) {
    return this.authService.removerStaff(req.user.id, staffId);
  }

  @Get('whatsapp-config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna a mensagem de agendamento configurada' })
  buscarMensagemWhatsapp(@Request() req: { user: { id: string } }) {
    return this.authService.buscarMensagemWhatsapp(req.user.id);
  }

  @Patch('whatsapp-config')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Atualiza a mensagem de confirmação de agendamento',
  })
  atualizarMensagemWhatsapp(
    @Request() req: { user: { id: string } },
    @Body() dto: AtualizarMensagemWhatsappDto,
  ) {
    return this.authService.atualizarMensagemWhatsapp(req.user.id, dto);
  }
}
