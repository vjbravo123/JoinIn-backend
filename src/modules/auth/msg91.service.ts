import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class Msg91Service {
  private readonly authKey: string;
  private readonly widgetId: string;

  constructor(private configService: ConfigService) {
    this.authKey = this.configService.getOrThrow<string>('MSG91_AUTH_KEY');
    this.widgetId = this.configService.getOrThrow<string>('MSG91_WIDGET_ID');
  }

  async sendOtp(phone: string): Promise<{ reqId: string; message: string }> {
    try {
      const response = await axios.post(
        'https://control.msg91.com/api/v5/widget/sendOtp',
        {
          widgetId: this.widgetId,
          tokenAuth: this.authKey,
          identifier: phone,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );

      // MSG91 returns the reqId in the "message" field on success
      const reqId = response.data?.message;
      if (!reqId || response.data?.type !== 'success') {
        throw new HttpException(
          response.data?.message || 'Failed to send OTP via MSG91',
          HttpStatus.BAD_REQUEST,
        );
      }

      return { reqId, message: response.data.message };
    } catch (error) {
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : 'Failed to send OTP via MSG91';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  async verifyOtp(phone: string, otp: string, reqId: string): Promise<boolean> {
    try {
      const response = await axios.post(
        'https://control.msg91.com/api/v5/widget/verifyOtp',
        {
          widgetId: this.widgetId,
          tokenAuth: this.authKey,
          identifier: phone,
          otp: otp,
          reqId: reqId,
        },
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
      return response.data?.type === 'success';
    } catch (error) {
      return false;
    }
  }
}