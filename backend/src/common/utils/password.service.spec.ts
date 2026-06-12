import { ConfigService } from '@nestjs/config';

import { PasswordService } from './password.service';

describe('PasswordService', () => {
  let service: PasswordService;

  beforeEach(() => {
    const config = {
      get: jest.fn().mockReturnValue(4),
    } as unknown as ConfigService;
    service = new PasswordService(config);
  });

  it('gera um hash diferente do texto original e válido na verificação', async () => {
    const hash = await service.hash('senha123');

    expect(hash).not.toBe('senha123');
    await expect(service.verify('senha123', hash)).resolves.toBe(true);
  });

  it('retorna false ao verificar uma senha incorreta', async () => {
    const hash = await service.hash('senha123');

    await expect(service.verify('senha-errada', hash)).resolves.toBe(false);
  });
});
