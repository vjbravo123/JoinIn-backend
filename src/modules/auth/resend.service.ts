import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { randomUUID, randomInt } from 'crypto';

interface OtpData {
  email: string;
  otp: string;
  expiresAt: number;
}

@Injectable()
export class ResendService {
  private readonly logger = new Logger(ResendService.name);
  private readonly apiKey: string;
  private readonly fromEmail: string;

  // Temporary in-memory OTP store (reqId -> OtpData)
  private otpStore = new Map<string, OtpData>();

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    this.fromEmail = this.configService.get<string>(
      'RESEND_FROM_EMAIL',
      'onboarding@resend.dev',
    );
  }

  async sendOtp(email: string): Promise<{ reqId: string; message: string }> {
    this.logger.debug(`sendOtp called for email=${email}`);

    // Generate random 6-digit OTP code and unique request ID
    const otp = randomInt(100000, 999999).toString();
    const reqId = randomUUID();
    const expiresAt = Date.now() + 10 * 60 * 1000; // Expires in 10 minutes

    // Save in store
    this.otpStore.set(reqId, { email, otp, expiresAt });

    const payload = {
      from: this.fromEmail,
      to: [email],
      subject: 'Your Verification Code',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Verification Code</h2>
          <p>Your OTP code is: <strong style="font-size: 24px; color: #4F46E5;">${otp}</strong></p>
          <p>This code will expire in 10 minutes.</p>
        </div>
      `,
    };

    try {
      const response = await axios.post(
        'https://api.resend.com/emails',
        payload,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(`sendOtp succeeded for email=${email}, reqId=${reqId}`);
      return { reqId, message: 'OTP sent successfully to email' };
    } catch (error) {
      this.otpStore.delete(reqId); // Clean up if email failed to send
      if (axios.isAxiosError(error)) {
        this.logger.error('Resend sendOtp axios error:', error.response?.data);
      } else {
        this.logger.error('Resend sendOtp unexpected error:', error);
      }
      throw new HttpException(
        'Failed to send OTP via email',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async verifyOtp(otp: string, reqId?: string, email?: string): Promise<boolean> {
    this.logger.debug(`verifyOtp called for reqId=${reqId}, email=${email}`);

    let matchKey: string | null = null;
    let otpData: OtpData | undefined;

    // Search by reqId if provided, otherwise fallback to searching by email
    if (reqId && this.otpStore.has(reqId)) {
      matchKey = reqId;
      otpData = this.otpStore.get(reqId);
    } else if (email) {
      for (const [key, value] of this.otpStore.entries()) {
        if (value.email === email) {
          matchKey = key;
          otpData = value;
          break;
        }
      }
    }

    if (!otpData || !matchKey) {
      this.logger.warn(`OTP record not found for reqId=${reqId}, email=${email}`);
      return false;
    }

    // Check expiration
    if (Date.now() > otpData.expiresAt) {
      this.otpStore.delete(matchKey);
      this.logger.warn(`OTP expired for email=${otpData.email}`);
      return false;
    }

    // Check code match
    if (otpData.otp !== otp.trim()) {
      return false;
    }

    // OTP verified successfully, clear from store
    this.otpStore.delete(matchKey);
    return true;
  }
}