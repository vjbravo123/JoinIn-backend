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

    // 1. Prevent joining if user already joined
    if (activity.participants.some((id) => id.equals(userObjectId))) {
      throw new BadRequestException('You already joined this activity');
    }

    // 2. Prevent joining if activity is full
    if (activity.participants.length >= activity.maxParticipants) {
      throw new BadRequestException('Activity is full');
    }

    // 3. Add user to Activity Participants
    activity.participants.push(userObjectId);
    await activity.save();

    // 4. Check if a GROUP chatroom exists for this activity
    let chatRoom = await this.chatRoomModel.findOne({
      activity: activity._id,
      type: 'GROUP',
    });

    if (!chatRoom) {
      // If group chatroom does not exist, create it and add ALL participants (host + all current joined members)
      const uniqueMembers = Array.from(
        new Set([
          activity.host.toString(),
          ...activity.participants.map((p) => p.toString()),
        ]),
      ).map((id) => new Types.ObjectId(id));

      chatRoom = await this.chatRoomModel.create({
        type: 'GROUP',
        activity: activity._id,
        members: uniqueMembers,
      });
    } else {
      // If group chatroom exists, add the newly joined user to members
      await this.chatRoomModel.updateOne(
        { _id: chatRoom._id },
        { $addToSet: { members: userObjectId } },
      );
    }

    // 5. Fetch populated activity details to return to the frontend
// 5. Fetch populated activity details to return to the frontend
    const updatedActivity = await this.activityModel
      .findById(activityId)
      .populate('host', 'name avatar isPhoneVerified')
      .exec();

    if (!updatedActivity) {
      throw new BadRequestException('Activity not found');
    }

    // Return the updated activity object with chatRoomId included
    return {
      ...updatedActivity.toObject(),
      chatRoomId: chatRoom._id,
    };
  }
}