import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleAsyncOptions, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Msg91Service } from './msg91.service';
import { JwtStrategy } from './jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    UsersModule,
    JwtModule.registerAsync({
    imports: [ConfigModule],
    useFactory: async (configService: ConfigService): Promise<JwtModuleOptions> => ({
      secret: configService.getOrThrow<string>('JWT_SECRET'),
      signOptions: {
    expiresIn: configService.get<number>('JWT_EXPIRES_IN_SECONDS') ?? 3600,
  },
    }),
    inject: [ConfigService],
  }),
  ],
  controllers: [AuthController],
  providers: [AuthService, Msg91Service, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}