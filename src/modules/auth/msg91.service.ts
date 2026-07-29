import { Injectable, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class Msg91Service {
  private readonly logger = new Logger(Msg91Service.name);
  private readonly authKey: string; // account authkey, sent via header now
  private readonly widgetId: string;

  constructor(private configService: ConfigService) {
    this.authKey = this.configService.getOrThrow<string>('MSG91_AUTH_KEY');
    this.widgetId = this.configService.getOrThrow<string>('MSG91_WIDGET_ID');
  }

  async sendOtp(phone: string): Promise<{ reqId: string; message: string }> {
    this.logger.debug(`sendOtp called for phone=${phone}`);

    const payload = {
      widgetId: this.widgetId,
      identifier: phone,
    };
    this.logger.debug(`sendOtp request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        'https://api.msg91.com/api/v5/widget/sendOtp',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            authkey: this.authKey,
          },
        },
      );

      this.logger.debug(`sendOtp raw response status: ${response.status}`);
      this.logger.debug(`sendOtp raw response data: ${JSON.stringify(response.data)}`);

      const reqId = response.data?.message;
      if (!reqId || response.data?.type !== 'success') {
        this.logger.error(
          `sendOtp failed for phone=${phone}: type=${response.data?.type}, message=${response.data?.message}`,
        );
        throw new HttpException(
          response.data?.message || 'Failed to send OTP via MSG91',
          HttpStatus.BAD_REQUEST,
        );
      }

      this.logger.log(`sendOtp succeeded for phone=${phone}, reqId=${reqId}`);
      return { reqId, message: response.data.message };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('MSG91 sendOtp axios error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          requestPayload: payload,
        });
      } else {
        this.logger.error('MSG91 sendOtp unexpected error:', error instanceof Error ? error.stack : error);
      }
      const message =
        axios.isAxiosError(error) && error.response?.data?.message
          ? error.response.data.message
          : 'Failed to send OTP via MSG91';
      throw new HttpException(message, HttpStatus.BAD_REQUEST);
    }
  }

  async verifyOtp(otp: string, reqId: string): Promise<boolean> {
    this.logger.debug(`verifyOtp called for reqId=${reqId}, otp=${otp}`);

    const payload = {
      widgetId: this.widgetId,
      reqId,
      otp,
    };
    this.logger.debug(`verifyOtp request payload: ${JSON.stringify(payload)}`);

    try {
      const response = await axios.post(
        'https://api.msg91.com/api/v5/widget/verifyOtp',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            authkey: this.authKey,
          },
        },
      );

      this.logger.debug(`verifyOtp raw response status: ${response.status}`);
      this.logger.debug(`verifyOtp raw response data: ${JSON.stringify(response.data)}`);

      const success = response.data?.type === 'success';
      this.logger.log(`verifyOtp result for reqId=${reqId}: ${success}`);
      return success;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error('MSG91 verifyOtp axios error:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          requestPayload: payload,
        });
      } else {
        this.logger.error('MSG91 verifyOtp unexpected error:', error instanceof Error ? error.stack : error);
      }
      return false;
    }
  }
}