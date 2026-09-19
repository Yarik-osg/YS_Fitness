import {
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  type LoginInput,
  type LogoutInput,
  type RefreshInput,
  type RegisterInput,
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
