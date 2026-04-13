import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'node:crypto';
import { Request } from 'express';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.config.get<string>('ADMIN_SECRET_KEY');
    if (!secret)
      throw new UnauthorizedException('ADMIN_SECRET_KEY não configurada');

    const req = context.switchToHttp().getRequest<Request>();
    const provided = req.headers['x-admin-key'];

    if (typeof provided !== 'string' || provided.length === 0) {
      throw new UnauthorizedException('Header x-admin-key ausente');
    }

    // Comparação segura contra timing attacks
    const expected = Buffer.from(secret);
    const received = Buffer.from(provided);

    if (
      expected.length !== received.length ||
      !crypto.timingSafeEqual(expected, received)
    ) {
      throw new UnauthorizedException('Chave inválida');
    }

    return true;
  }
}
