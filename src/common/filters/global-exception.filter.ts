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

    let mensagem: string;
    if (exception instanceof HttpException) {
      mensagem = String(exception.message);
    } else if (exception instanceof Error) {
      mensagem = exception.message;
    } else {
      mensagem = 'Erro desconhecido';
    }

    const stack = exception instanceof Error ? exception.stack : undefined;

    response.status(status).json({
      statusCode: status,
      message: mensagem,
      timestamp: new Date().toISOString(),
      path: request.url,
    });

    // Só alerta erros de servidor (5xx) — erros de cliente (4xx) são normais
    if (status >= 500) {
      this.logger.error(
        `[${status}] ${request.method} ${request.url} — ${mensagem}`,
        stack,
      );

      this.email
        .enviarAlertaErro({
          metodo: request.method,
          url: request.url,
          status,
          mensagem,
          stack,
        })
        .catch(() => {
          // Silencia falha no alerta para não gerar loop
        });
    }
  }
}
