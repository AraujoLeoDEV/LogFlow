import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PasswordService } from '../../common/utils/password.service';
import { parseDurationToMs } from '../../common/utils/duration.util';
import { JwtPayload } from '../../common/types/jwt-payload.interface';
import { PrismaService } from '../../prisma/prisma.service';
import { User } from '../../../generated/prisma/client';
import { LoginDto } from './dto/login.dto';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: User['role'];
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        `Conta bloqueada até ${user.lockedUntil.toLocaleString('pt-BR')} devido a múltiplas tentativas de login inválidas.`,
      );
    }

    const passwordMatches = await this.passwordService.verify(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.registerFailedAttempt(user);
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    return this.buildTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user || user.deletedAt || !user.isActive) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    return this.buildTokens(user);
  }

  private async registerFailedAttempt(user: User): Promise<void> {
    const maxAttempts = this.config.get<number>('LOGIN_MAX_ATTEMPTS', 5);
    const lockoutMinutes = this.config.get<number>('LOGIN_LOCKOUT_MINUTES', 15);
    const attempts = user.failedLoginAttempts + 1;

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lockedUntil:
          attempts >= maxAttempts
            ? new Date(Date.now() + lockoutMinutes * 60_000)
            : null,
      },
    });
  }

  private buildTokens(user: User): AuthTokens {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_SECRET'),
      expiresIn: Math.floor(
        parseDurationToMs(this.config.get<string>('JWT_EXPIRES_IN', '15m')) /
          1000,
      ),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: Math.floor(
        parseDurationToMs(
          this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        ) / 1000,
      ),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
