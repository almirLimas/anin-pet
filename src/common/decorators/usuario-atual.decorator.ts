import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UsuarioAtual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: unknown }>();
    return request.user;
  },
);
