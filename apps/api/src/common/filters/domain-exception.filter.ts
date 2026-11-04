import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { toConflict } from '../use-case-result';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      return response.status(status).json(res);
    }

    const conflict = toConflict(exception);
    if (conflict) return response.status(conflict.getStatus()).json(conflict.getResponse());

    const error = exception as Error;
    const domainErrors = [
      'Ingresá un teléfono válido',
      'Teléfono es obligatorio',
      'código de área inválido',
      'solo números',
      'Email es obligatorio',
      'e-mail válido',
      'no puede exceder 254 caracteres',
      'Contraseña es obligatoria',
      'mínimo 8 caracteres',
      'mayúscula',
      'minúscula',
      'número',
      'Nombre del negocio es obligatorio',
      'más de 3 caracteres',
      'menos de 45 caracteres',
      'caracteres alfanuméricos',
      'Nombre es obligatorio',
      'Tu nombre debe tener',
    ];

    const isDomainError = domainErrors.some(msg => error.message.includes(msg));

    if (isDomainError) {
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        message: error.message,
        error: 'Bad Request',
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      error: 'Internal Server Error',
    });
  }
}