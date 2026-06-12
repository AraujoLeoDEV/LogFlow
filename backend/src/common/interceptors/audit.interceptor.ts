import { Observable } from 'rxjs';

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';

import { AuthenticatedUser } from '../types/jwt-payload.interface';

interface AuditableRequest {
  method: string;
  user?: AuthenticatedUser;
  body: Record<string, unknown>;
}

/**
 * Preenche `createdBy`/`updatedBy` no body da requisição com o id do usuário
 * autenticado, para módulos cujas entidades possuem esses campos de auditoria
 * (a partir da Fase 2 — seção 5 do CLAUDE.md).
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuditableRequest>();

    if (request.user && request.body && typeof request.body === 'object') {
      if (request.method === 'POST') {
        request.body.createdBy = request.user.sub;
      }
      if (request.method === 'PATCH' || request.method === 'PUT') {
        request.body.updatedBy = request.user.sub;
      }
    }

    return next.handle();
  }
}
