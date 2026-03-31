import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegistrarDto } from './dto/registrar.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
      include: { tenant: { select: { id: true, nome: true, plano: true } } },
    });

    if (!usuario) throw new UnauthorizedException('Credenciais inválidas');

    const senhaValida = await bcrypt.compare(dto.senha, usuario.senhaHash);
    if (!senhaValida) throw new UnauthorizedException('Credenciais inválidas');

    if (usuario.status === 'inativo')
      throw new UnauthorizedException('Usuário inativo');

    const token = this.jwt.sign({
      sub: usuario.id,
      email: usuario.email,
      perfil: usuario.perfil,
      tenantId: usuario.tenantId,
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
        tenant: { select: { nome: true, plano: true } },
      },
    });

    if (!usuario) throw new UnauthorizedException();

    return {
      ...usuario,
      nomePetshop: usuario.tenant.nome,
      plano: usuario.tenant.plano,
    };
  }
}
