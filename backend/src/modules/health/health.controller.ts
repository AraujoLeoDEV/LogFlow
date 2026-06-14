import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  // Endpoint de health check precisa ser acessível sem autenticação para
  // load balancers/orquestradores (Fase 14 - hardening) - não expõe dados
  // sensíveis, apenas status da API e da conexão com o banco.
  @Public()
  @Get()
  check() {
    return this.healthService.check();
  }
}
