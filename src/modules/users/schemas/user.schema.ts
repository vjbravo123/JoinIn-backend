import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ default: false })
  isEmailVerified: boolean;

  @Prop({ unique: true, sparse: true, trim: true })
  username?: string;

  @Prop({ select: false }) // Hide password from standard query responses
  password?: string;

  @Prop({ select: false })
  otp?: string;

  @Prop({ select: false })
  otpExpiresAt?: Date;

  @Prop()
  name?: string;

  @Prop()
  avatar?: string;

  @Prop()
  bio?: string;

  @Prop({ type: [String], default: [] })
  interests: string[];
}

export const UserSchema = SchemaFactory.createForClass(User);