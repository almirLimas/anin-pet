import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { EsqueceuSenhaDto } from './dto/esqueceu-senha.dto';
import { LoginDto } from './dto/login.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { RegistrarDto } from './dto/registrar.dto';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: {
        tenant: {
          select: {
            id: true,
            nome: true,
            plano: true,
            assinaturaStatus: true,
            trialExpiraEm: true,
          },
        },
      },
    });

    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    if (usuario.status === 'inativo')
      throw new UnauthorizedException('Usuário inativo');

    const { assinaturaStatus } = usuario.tenant;

    const token = this.jwt.sign({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      tenantId: usuario.tenantId,
      assinaturaStatus,
    });

    return {
      access_token: token,
      usuario: {
        id: usuario.id,
        nomeCompleto: usuario.nomeCompleto,
        email: usuario.email,
        perfil: usuario.perfil,
        tenantId: usuario.tenantId,
        nomePetshop: usuario.tenant.nome,
        plano: usuario.tenant.plano,
        assinaturaStatus: usuario.tenant.assinaturaStatus,
        trialExpiraEm: usuario.tenant.trialExpiraEm,
      },
    };
  }

  async registrar(dto: RegistrarDto) {
    const existe = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    if (existe) throw new ConflictException('E-mail já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    // Cria o tenant (petshop) e o usuário admin em uma transação
    const resultado = await this.prisma.$transaction(async (tx) => {
      const trialExpiraEm = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const tenant = await tx.tenant.create({
        data: {
          nome: dto.nomePetshop,
          plano: dto.plano ?? 'basico',
          trialExpiraEm,
        },
      });

      const usuario = await tx.usuario.create({
        data: {
          nomeCompleto: dto.nomeCompleto,
          email: dto.email,
          telefone: dto.telefone,
          senhaHash,
          perfil: dto.perfil ?? 'admin',
          tenantId: tenant.id,
        },
      });

      return { usuario, tenant };
    });

    const token = this.jwt.sign({
      sub: resultado.usuario.id,
      email: resultado.usuario.email,
      perfil: resultado.usuario.perfil,
      tenantId: resultado.tenant.id,
    });

    // Notifica o admin sobre o novo cadastro (fire-and-forget)
    this.email
      .enviarNotificacaoNovoCadastro(
        resultado.usuario.nomeCompleto,
        resultado.usuario.email,
        resultado.tenant.nome,
      )
      .catch(() => {});

    return {
      access_token: token,
      id: resultado.usuario.id,
      nomeCompleto: resultado.usuario.nomeCompleto,
      email: resultado.usuario.email,
      perfil: resultado.usuario.perfil,
      tenantId: resultado.tenant.id,
      nomePetshop: resultado.tenant.nome,
      plano: resultado.tenant.plano,
    };
  }

  async atualizarPerfil(usuarioId: string, dto: AtualizarPerfilDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
    });

    if (!usuario) throw new UnauthorizedException();

    if (dto.novaSenha) {
      if (!dto.senhaAtual)
        throw new UnauthorizedException('Informe a senha atual para alterá-la');
      const senhaValida = await bcrypt.compare(
        dto.senhaAtual,
        usuario.senhaHash,
      );
      if (!senhaValida)
        throw new UnauthorizedException('Senha atual incorreta');
    }

    const data: Record<string, unknown> = {};
    if (dto.nomeCompleto) data.nomeCompleto = dto.nomeCompleto;
    if (dto.telefone) data.telefone = dto.telefone;
    if (dto.novaSenha) data.senhaHash = await bcrypt.hash(dto.novaSenha, 10);

    const atualizado = await this.prisma.usuario.update({
      where: { id: usuarioId },
      data,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        telefone: true,
        perfil: true,
      },
    });

    return atualizado;
  }

  async perfil(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        telefone: true,
        perfil: true,
        status: true,
        tenantId: true,
        createdAt: true,
        tenant: {
          select: {
            nome: true,
            plano: true,
            assinaturaStatus: true,
            trialExpiraEm: true,
          },
        },
      },
    });

    if (!usuario) throw new UnauthorizedException();

    return {
      ...usuario,
      nomePetshop: usuario.tenant.nome,
      plano: usuario.tenant.plano,
      assinaturaStatus: usuario.tenant.assinaturaStatus,
      trialExpiraEm: usuario.tenant.trialExpiraEm,
    };
  }

  async solicitarResetSenha(dto: EsqueceuSenhaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });

    // Retorna sempre a mesma resposta para não revelar se o e-mail existe
    if (!usuario)
      return { mensagem: 'Se o e-mail existir, enviaremos o link.' };

    const token = crypto.randomBytes(32).toString('hex');
    const expiraEm = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: { resetToken: token, resetTokenExpiraEm: expiraEm },
    });

    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const link = `${frontendUrl}/redefinir-senha?token=${token}`;

    await this.email.enviarResetSenha(
      usuario.email,
      usuario.nomeCompleto,
      link,
    );

    return { mensagem: 'Se o e-mail existir, enviaremos o link.' };
  }

  async redefinirSenha(dto: RedefinirSenhaDto) {
    const usuario = await this.prisma.usuario.findFirst({
      where: {
        resetToken: dto.token,
        resetTokenExpiraEm: { gt: new Date() },
      },
    });

    if (!usuario) throw new BadRequestException('Token inválido ou expirado.');

    const senhaHash = await bcrypt.hash(dto.novaSenha, 10);

    await this.prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        senhaHash,
        resetToken: null,
        resetTokenExpiraEm: null,
      },
    });

    return { mensagem: 'Senha redefinida com sucesso.' };
  }
}
