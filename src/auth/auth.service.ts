import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';
import { AtualizarMetaDto } from './dto/atualizar-meta.dto';
import { AtualizarTaxaBuscaDto } from './dto/atualizar-taxa-busca.dto';
import { EsqueceuSenhaDto } from './dto/esqueceu-senha.dto';
import { LoginDto } from './dto/login.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';
import { RegistrarDto } from './dto/registrar.dto';
import { CriarStaffDto } from './dto/criar-staff.dto';
import { AtualizarStaffDto } from './dto/atualizar-staff.dto';
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

    // Valida dígitos verificadores do CPF
    const cpfDigits = dto.cpf.replaceAll('.', '').replaceAll('-', '');
    if (!this.validarCpf(cpfDigits))
      throw new BadRequestException('CPF inválido');

    const cpfExiste = await this.prisma.usuario.findUnique({
      where: { cpf: dto.cpf },
    });
    if (cpfExiste) throw new ConflictException('CPF já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    // Cria o tenant (petshop) e o usuário admin em uma transação
    const resultado = await this.prisma.$transaction(async (tx) => {
      const trialExpiraEm = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

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
          cpf: dto.cpf,
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

    // E-mail de boas-vindas com primeiros passos para o novo petshop (fire-and-forget)
    this.email
      .enviarBoasVindas(
        resultado.usuario.email,
        resultado.usuario.nomeCompleto,
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

  async onboardingStatus(usuarioId: string) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tenantId: true },
    });
    if (!usuario) throw new UnauthorizedException();
    const tenantId = usuario.tenantId;

    const [
      temCliente,
      temServico,
      temProduto,
      temAgendamento,
      temVenda,
      temAgendamentoConcluido,
    ] = await Promise.all([
      this.prisma.cliente.count({ where: { tenantId } }),
      this.prisma.servico.count({ where: { tenantId } }),
      this.prisma.produto.count({ where: { tenantId } }),
      this.prisma.agendamento.count({ where: { tenantId } }),
      this.prisma.venda.count({ where: { tenantId } }),
      this.prisma.agendamento.count({
        where: { tenantId, status: 'Concluido' },
      }),
    ]);

    return {
      temCliente: temCliente > 0,
      temServico: temServico > 0 || temProduto > 0,
      temAgendamento: temAgendamento > 0,
      temVenda: temVenda > 0,
      temAgendamentoConcluido: temAgendamentoConcluido > 0,
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
            metaMensal: true,
            taxaBusca: true,
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
      metaMensal: usuario.tenant.metaMensal
        ? Number(usuario.tenant.metaMensal)
        : null,
      taxaBusca: usuario.tenant.taxaBusca
        ? Number(usuario.tenant.taxaBusca)
        : null,
    };
  }

  async atualizarMeta(usuarioId: string, dto: AtualizarMetaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tenantId: true },
    });
    if (!usuario) throw new UnauthorizedException();

    await this.prisma.tenant.update({
      where: { id: usuario.tenantId },
      data: { metaMensal: dto.metaMensal },
    });

    return { metaMensal: dto.metaMensal };
  }

  async atualizarTaxaBusca(usuarioId: string, dto: AtualizarTaxaBuscaDto) {
    const usuario = await this.prisma.usuario.findUnique({
      where: { id: usuarioId },
      select: { tenantId: true },
    });
    if (!usuario) throw new UnauthorizedException();

    await this.prisma.tenant.update({
      where: { id: usuario.tenantId },
      data: { taxaBusca: dto.taxaBusca },
    });

    return { taxaBusca: dto.taxaBusca };
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

  async criarStaff(adminId: string, dto: CriarStaffDto) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: {
        tenantId: true,
        perfil: true,
        tenant: { select: { plano: true } },
      },
    });

    if (admin.perfil !== 'admin') {
      throw new ForbiddenException(
        'Apenas administradores podem criar funcionários',
      );
    }

    const limiteStaff = admin.tenant.plano === 'plus' ? 5 : 3;

    const totalStaff = await this.prisma.usuario.count({
      where: { tenantId: admin.tenantId, perfil: { not: 'admin' } },
    });

    if (totalStaff >= limiteStaff) {
      throw new BadRequestException(
        `Limite de ${limiteStaff} funcionários atingido para o plano ${admin.tenant.plano}`,
      );
    }

    const existe = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (existe) throw new ConflictException('E-mail já cadastrado');

    const senhaHash = await bcrypt.hash(dto.senha, 10);

    const usuario = await this.prisma.usuario.create({
      data: {
        nomeCompleto: dto.nomeCompleto,
        email: dto.email,
        telefone: dto.telefone,
        senhaHash,
        perfil: dto.perfil as any,
        tenantId: admin.tenantId,
      },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        perfil: true,
        telefone: true,
      },
    });

    return usuario;
  }

  async verificarEmail(email: string) {
    const existe = await this.prisma.usuario.findUnique({
      where: { email },
      select: { id: true },
    });
    return { disponivel: !existe };
  }

  async listarStaff(adminId: string) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: { tenantId: true, perfil: true },
    });

    if (admin.perfil !== 'admin') {
      throw new ForbiddenException(
        'Apenas administradores podem listar funcionários',
      );
    }

    return this.prisma.usuario.findMany({
      where: { tenantId: admin.tenantId, perfil: { not: 'admin' } },
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        perfil: true,
        telefone: true,
        status: true,
      },
      orderBy: { nomeCompleto: 'asc' },
    });
  }

  async atualizarStaff(
    adminId: string,
    staffId: string,
    dto: AtualizarStaffDto,
  ) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: { tenantId: true, perfil: true },
    });

    if (admin.perfil !== 'admin')
      throw new ForbiddenException(
        'Apenas administradores podem editar funcionários',
      );

    const staffMember = await this.prisma.usuario.findFirst({
      where: {
        id: staffId,
        tenantId: admin.tenantId,
        perfil: { not: 'admin' },
      },
    });

    if (!staffMember) throw new NotFoundException('Funcionário não encontrado');

    const data: Record<string, unknown> = {};
    if (dto.nomeCompleto) data.nomeCompleto = dto.nomeCompleto;
    if (dto.telefone !== undefined) data.telefone = dto.telefone;
    if (dto.perfil) data.perfil = dto.perfil;
    if (dto.novaSenha) data.senhaHash = await bcrypt.hash(dto.novaSenha, 10);

    return this.prisma.usuario.update({
      where: { id: staffId },
      data,
      select: {
        id: true,
        nomeCompleto: true,
        email: true,
        perfil: true,
        telefone: true,
        status: true,
      },
    });
  }

  async removerStaff(adminId: string, staffId: string) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: { tenantId: true, perfil: true },
    });

    if (admin.perfil !== 'admin') {
      throw new ForbiddenException(
        'Apenas administradores podem remover funcionários',
      );
    }

    const staff = await this.prisma.usuario.findFirst({
      where: {
        id: staffId,
        tenantId: admin.tenantId,
        perfil: { not: 'admin' },
      },
    });

    if (!staff) throw new NotFoundException('Funcionário não encontrado');

    await this.prisma.usuario.delete({ where: { id: staffId } });

    return { removido: true };
  }

  async buscarMensagemWhatsapp(adminId: string) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: { tenantId: true },
    });
    const tenant = await this.prisma.tenant.findUniqueOrThrow({
      where: { id: admin.tenantId },
      select: { mensagemAgendamento: true, mensagemAvaliacao: true },
    });
    return {
      mensagem:
        tenant.mensagemAgendamento ??
        'Olá, {nome}! 🐾 Seu agendamento para {pet} foi confirmado.\nServiço: {servico}\nData: {data} às {hora}\nAté lá! 😊',
      mensagemAvaliacao:
        tenant.mensagemAvaliacao ??
        'Olá, {nome}! 🐾 Esperamos que {pet} tenha adorado o serviço!\n\nPoderia avaliar o atendimento? Leva menos de 1 minuto 😊\n{link}',
    };
  }

  async atualizarMensagemWhatsapp(
    adminId: string,
    dto: { mensagem?: string; mensagemAvaliacao?: string },
  ) {
    const admin = await this.prisma.usuario.findUniqueOrThrow({
      where: { id: adminId },
      select: { tenantId: true, perfil: true },
    });
    if (admin.perfil !== 'admin') {
      throw new ForbiddenException(
        'Apenas administradores podem alterar essa configuração',
      );
    }
    await this.prisma.tenant.update({
      where: { id: admin.tenantId },
      data: {
        ...(dto.mensagem !== undefined && {
          mensagemAgendamento: dto.mensagem,
        }),
        ...(dto.mensagemAvaliacao !== undefined && {
          mensagemAvaliacao: dto.mensagemAvaliacao,
        }),
      },
    });
    return { atualizado: true };
  }

  private validarCpf(digits: string): boolean {
    if (digits.length !== 11) return false;
    if (/^(\d)\1{10}$/.test(digits)) return false;

    const calc = (end: number): number => {
      let sum = 0;
      for (let i = 0; i < end; i++) sum += Number(digits[i]) * (end + 1 - i);
      const rem = (sum * 10) % 11;
      return rem === 10 ? 0 : rem;
    };

    return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
  }
}
