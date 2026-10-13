import {
  forgotPasswordSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type LogoutInput,
  type RefreshInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@repo/validation';

export class RegisterDto implements RegisterInput {
  static readonly schema = registerSchema;

  email!: string;
  password!: string;
  clientType!: 'WEB' | 'MOBILE';
  deviceName?: string;
}

export class LoginDto implements LoginInput {
  static readonly schema = loginSchema;

  email!: string;
  password!: string;
  clientType!: 'WEB' | 'MOBILE';
  deviceName?: string;
}

export class RefreshDto implements RefreshInput {
  static readonly schema = refreshSchema;

  refreshToken?: string;
  clientType!: 'WEB' | 'MOBILE';
}

export class LogoutDto implements LogoutInput {
  static readonly schema = logoutSchema;

  refreshToken?: string;
  clientType!: 'WEB' | 'MOBILE';
}

export class ForgotPasswordDto implements ForgotPasswordInput {
  static readonly schema = forgotPasswordSchema;

  email!: string;
  locale?: 'uk' | 'en';
}

export class ResetPasswordDto implements ResetPasswordInput {
  static readonly schema = resetPasswordSchema;

  token!: string;
  password!: string;
  locale?: 'uk' | 'en';
}
