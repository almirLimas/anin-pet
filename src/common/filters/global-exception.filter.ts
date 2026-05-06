import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { EmailService } from '../../auth/email.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  constructor(private readonly email: EmailService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let mensagem: string | string[];
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'string') {
        mensagem = res;
      } else if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        mensagem =
          (r['message'] as string | string[]) ?? String(exception.message);
      } else {
        mensagem = String(exception.message);
      }
    } else if (exception instanceof Error) {
      mensagem = exception.message;
    } else {
      mensagem = 'Erro desconhecido';
    }

    const stack = exception instanceof Error ? exception.stack : undefined;

    if (status < 500) {
      this.logger.warn(
        `[${status}] ${request.method} ${request.url} — ${JSON.stringify(mensagem)}`,
      );
    }

    response.status(status).json({
      statusCode: status,
      message: mensagem,
      timestamp: new Date().toISOString(),
      path: request.url,
    });

    // Só alerta erros de servidor (5xx) — erros de cliente (4xx) são normais
    if (status >= 500) {
      const mensagemStr = Array.isArray(mensagem)
        ? mensagem.join('; ')
        : mensagem;
      this.logger.error(
        `[${status}] ${request.method} ${request.url} — ${mensagemStr}`,
        stack,
      );

      this.email
        .enviarAlertaErro({
          metodo: request.method,
          url: request.url,
          status,
          mensagem: mensagemStr,
          stack,
        })
        .catch(() => {
          // Silencia falha no alerta para não gerar loop
        });
    }
  }
}
