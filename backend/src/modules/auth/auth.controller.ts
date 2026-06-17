import type { Request, Response } from 'express';

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

import { Public } from '../../common/decorators/public.decorator';
import { parseDurationToMs } from '../../common/utils/duration.util';
import { AuthService } from './auth.service';
import { AuthResponseDto } from './dto/auth-response.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

const REFRESH_TOKEN_COOKIE = 'refresh_token';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({
    summary: 'Autentica um usuário e retorna access token + cookie de refresh',
  })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);
    this.setRefreshTokenCookie(res, refreshToken);
    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({
    summary:
      'Renova o access token a partir do refresh token (cookie httpOnly)',
  })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[
      REFRESH_TOKEN_COOKIE
    ];

    if (!refreshToken) {
      throw new UnauthorizedException('Sessão expirada. Faça login novamente.');
    }

    const {
      accessToken,
      refreshToken: newRefreshToken,
      user,
    } = await this.authService.refresh(refreshToken);
    this.setRefreshTokenCookie(res, newRefreshToken);
    return { accessToken, user };
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary:
      'Envia e-mail com link de redefinição de senha (resposta sempre 204 para não revelar e-mails cadastrados)',
  })
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Redefine a senha usando o token recebido por e-mail',
  })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.authService.resetPassword(dto);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Invalida o cookie de refresh token' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/auth' });
  }

  private setRefreshTokenCookie(res: Response, token: string): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: this.config.get<string>('APP_ENV') === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: parseDurationToMs(
        this.config.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
      ),
    });
  }
}
