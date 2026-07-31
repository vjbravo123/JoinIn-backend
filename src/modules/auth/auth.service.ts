import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ResendService } from './resend.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly resendService: ResendService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 1. Send OTP to email
  async sendOtp(email: string) {
    return await this.resendService.sendOtp(email);
  }

  // 2. Verify OTP and mark email as verified
  async verifyOtp(email: string, otp: string, reqId?: string) {
    const isValid = await this.resendService.verifyOtp(otp, reqId, email);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user = await this.usersService.findByEmail(email);

    if (!user) {
      user = await this.usersService.createUser({ email });
    }

    const verifiedUser = await this.usersService.markEmailAsVerified(
      String(user._id),
    );

    if (!verifiedUser) {
      throw new BadRequestException('Failed to verify user email address');
    }

    return {
      message: 'Email address verified successfully',
      isEmailVerified: true,
      userId: verifiedUser._id,
      email: verifiedUser.email,
    };
  }

  // 3. Complete user signup with username & password after OTP verification
  async register(registerDto: RegisterDto) {
    const { email, username, password, name } = registerDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new BadRequestException(
        'Please verify your email address via OTP before registering.',
      );
    }

    if (!user.isEmailVerified) {
      throw new BadRequestException(
        'Email address is not verified. Please verify OTP first.',
      );
    }

    // Check if username is already taken by another user
    const existingUsername = await this.usersService.findByUsername(username);
    if (
      existingUsername &&
      String(existingUsername._id) !== String(user._id)
    ) {
      throw new ConflictException('Username is already taken');
    }

    // Hash user password
    const hashedPassword = await bcrypt.hash(password, 10);

    const updatedUser = await this.usersService.updateProfile(
      String(user._id),
      {
        username,
        password: hashedPassword,
        ...(name ? { name } : {}),
      },
    );

    if (!updatedUser) {
      throw new BadRequestException('Failed to register user credentials');
    }

    const payload = {
      sub: String(updatedUser._id),
      username: updatedUser.username,
      email: updatedUser.email,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: updatedUser._id,
        email: updatedUser.email,
        username: updatedUser.username,
        name: updatedUser.name,
        isEmailVerified: updatedUser.isEmailVerified,
      },
    };
  }

  // 4. Login using username and password
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;

    // Fetch user including hidden password field
    const user = await this.usersService.findByUsername(username, true);
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!user.isEmailVerified) {
      throw new UnauthorizedException(
        'Email address not verified. Please verify your email via OTP.',
      );
    }

    if (!user.password) {
      throw new UnauthorizedException(
        'Password not configured for this account. Please complete registration.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const payload = {
      sub: String(user._id),
      username: user.username,
      email: user.email,
    };

    const accessToken = this.jwtService.sign(payload);

    // Safely delete sensitive fields before returning user object
    const userObj = (user.toObject ? user.toObject() : user) as Record<string, any>;
    delete userObj.password;

    return {
      accessToken,
      user: userObj,
    };
  }
}