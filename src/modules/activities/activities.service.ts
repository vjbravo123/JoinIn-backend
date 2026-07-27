import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Activity, ActivityDocument } from './schemas/activity.schema';
import { CreateActivityDto } from './dto/create-activity.dto';
import { ChatRoom, ChatRoomDocument } from '../chat/schemas/chat-room.schema';

@Injectable()
export class ActivitiesService {
  constructor(
    @InjectModel(Activity.name) private activityModel: Model<ActivityDocument>,
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
  ) {}

  async createActivity(hostId: string, dto: CreateActivityDto) {
    const hostObjectId = new Types.ObjectId(hostId);

    // 1. Create Activity with Host as initial participant
    const activity = await this.activityModel.create({
      ...dto,
      eventDate: new Date(dto.eventDate),
      host: hostObjectId,
      participants: [hostObjectId],
    });

    // 2. Automatically create Group Chat Room for this activity
    await this.chatRoomModel.create({
      type: 'GROUP',
      activity: activity._id,
      members: [hostObjectId],
    });

    return activity;
  }

  async findAll(category?: string) {
    const filter = category ? { category } : {};
    return this.activityModel
      .find(filter)
      .populate('host', 'name avatar')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string) {
    return this.activityModel
      .findById(id)
      .populate('host', 'name avatar bio')
      .populate('participants', 'name avatar')
      .exec();
  }

  async joinActivity(userId: string, activityId: string) {
    const activity = await this.activityModel.findById(activityId);
    if (!activity) throw new BadRequestException('Activity not found');

    const userObjectId = new Types.ObjectId(userId);

    if (activity.participants.some((id) => id.equals(userObjectId))) {
      throw new BadRequestException('You already joined this activity');
    }

    if (activity.participants.length >= activity.maxParticipants) {
      throw new BadRequestException('Activity is full');
    }

    // Add user to Activity Participants
    activity.participants.push(userObjectId);
    await activity.save();

    // Add user to Activity Group Chat
    await this.chatRoomModel.updateOne(
      { activity: activity._id },
      { $addToSet: { members: userObjectId } },
    );

    return activity;
  }
}