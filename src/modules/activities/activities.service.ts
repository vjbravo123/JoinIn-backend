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

  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  async findAll(category?: string, lat?: number, lng?: number) {
    const filter = category ? { category } : {};

    const activities = await this.activityModel
      .find(filter)
      .populate('host', 'name avatar')
      .exec();

    // If valid lat/lng provided, sort nearest-first instead of newest-first
    if (
      lat !== undefined &&
      lng !== undefined &&
      !isNaN(lat) &&
      !isNaN(lng)
    ) {
      return activities
        .map((a) => ({
          ...a.toObject(),
          distance: this.haversineDistance(lat, lng, a.latitude, a.longitude),
        }))
        .sort((a, b) => a.distance - b.distance);
    }

    // Default: newest first
    return activities.sort(
      (a: any, b: any) =>
        b.get('createdAt').getTime() - a.get('createdAt').getTime(),
    );
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

    // 3. ATOMIC UPDATE: Add user to Activity Participants using $addToSet
    // This avoids calling .save() which triggers full schema re-validation
    await this.activityModel.updateOne(
      { _id: activityId },
      { $addToSet: { participants: userObjectId } },
    );

    // 4. Check if a GROUP chatroom exists for this activity
    let chatRoom = await this.chatRoomModel.findOne({
      activity: activity._id,
      type: 'GROUP',
    });

    if (!chatRoom) {
      // Collect unique member IDs cleanly
      const existingHostId = activity.host ? activity.host.toString() : userId;
      const existingParticipants = activity.participants.map((p) => p.toString());

      const uniqueMembers = Array.from(
        new Set([existingHostId, ...existingParticipants, userId]),
      ).map((id) => new Types.ObjectId(id));

      chatRoom = await this.chatRoomModel.create({
        type: 'GROUP',
        activity: activity._id,
        members: uniqueMembers,
      });
    } else {
      // Add newly joined user to group chat members
      await this.chatRoomModel.updateOne(
        { _id: chatRoom._id },
        { $addToSet: { members: userObjectId } },
      );
    }

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