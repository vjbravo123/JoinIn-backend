import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import { Activity, ActivityDocument } from '../activities/schemas/activity.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
  ) {}

  async findById(userId: string) {
    return this.userModel.findById(userId).exec();
  }

  async findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  // Used during authentication to check login credentials
  async findByUsername(username: string, includePassword = false) {
    const query = this.userModel.findOne({ username });
    if (includePassword) {
      query.select('+password');
    }
    return query.exec();
  }

  // Create user during registration
  async createUser(data: { email: string; username?: string; password?: string }) {
    return this.userModel.create({
      ...data,
      email: data.email.toLowerCase(),
    });
  }

  // Save generated OTP and expiration time for verification
  async setOtp(userId: string, otp: string, expiresAt: Date) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { otp, otpExpiresAt: expiresAt },
        { new: true },
      )
      .exec();
  }

  // Find user and select secret OTP fields for validation
  async findWithOtp(email: string) {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+otp +otpExpiresAt')
      .exec();
  }

  // Mark profile email as verified after successfully validating OTP
  async markEmailAsVerified(userId: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { isEmailVerified: true, $unset: { otp: 1, otpExpiresAt: 1 } },
        { new: true },
      )
      .exec();
  }

  async updateProfile(userId: string, data: Partial<User>) {
    return this.userModel.findByIdAndUpdate(userId, data, { new: true }).exec();
  }

  async getHostedActivities(userId: string) {
    return this.activityModel
      .find({ host: new Types.ObjectId(userId) })
      .populate('participants', 'name avatar')
      .exec();
  }

  async getJoinedActivities(userId: string) {
    return this.activityModel
      .find({ participants: new Types.ObjectId(userId) })
      .populate('host', 'name avatar')
      .exec();
  }
}