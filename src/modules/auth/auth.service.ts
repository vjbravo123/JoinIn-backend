import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Msg91Service } from './msg91.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly msg91Service: Msg91Service,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  // 1. Send OTP to phone
  async sendOtp(phone: string) {
    return await this.msg91Service.sendOtp(phone);
  }

  // 2. Verify OTP and mark phone as verified
  async verifyOtp(phone: string, otp: string, reqId: string) {
    const isValid = await this.msg91Service.verifyOtp(otp, reqId);
    if (!isValid) {
      throw new UnauthorizedException('Invalid or expired OTP');
    }

    let user = await this.usersService.findByPhone(phone);

    if (!user) {
      user = await this.usersService.createUser({ phone });
    }

    const verifiedUser = await this.usersService.markPhoneAsVerified(
      String(user._id),
    );

    if (!verifiedUser) {
      throw new BadRequestException('Failed to verify user phone number');
    }

    return {
      message: 'Mobile number verified successfully',
      isPhoneVerified: true,
      userId: verifiedUser._id,
      phone: verifiedUser.phone,
    };
  }

  // 3. Complete user signup with username & password after OTP verification
  async register(registerDto: RegisterDto) {
    const { phone, username, password, name } = registerDto;

    const user = await this.usersService.findByPhone(phone);
    if (!user) {
      throw new BadRequestException(
        'Please verify your mobile number via OTP before registering.',
      );
    }

    if (!user.isPhoneVerified) {
      throw new BadRequestException(
        'Mobile number is not verified. Please verify OTP first.',
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
      phone: updatedUser.phone,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: updatedUser._id,
        phone: updatedUser.phone,
        username: updatedUser.username,
        name: updatedUser.name,
        isPhoneVerified: updatedUser.isPhoneVerified,
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

    if (!user.isPhoneVerified) {
      throw new UnauthorizedException(
        'Mobile number not verified. Please verify your mobile number via OTP.',
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
      phone: user.phone,
    };

    const accessToken = this.jwtService.sign(payload);

    // Safely delete sensitive fields before returning the user object
    const userObj = (user.toObject ? user.toObject() : user) as Record<string, any>;
    delete userObj.password;

    return {
      accessToken,
      user: userObj,
    };
  }
}