import * as bcrypt from 'bcrypt';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PasswordService {
  constructor(private readonly config: ConfigService) {}

  async hash(plain: string): Promise<string> {
    const rounds = Number(this.config.get('BCRYPT_ROUNDS', 10));
    return bcrypt.hash(plain, rounds);
  }

  async verify(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
