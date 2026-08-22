import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ChatRoom, ChatRoomDocument } from './schemas/chat-room.schema';
import { Message, MessageDocument } from './schemas/message.schema';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(ChatRoom.name) private chatRoomModel: Model<ChatRoomDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
  ) {}

  // backend: chat.service.ts
async getOrCreateDirectChat(userA: string, userB: string) {
  const objUserA = new Types.ObjectId(userA);
  const objUserB = new Types.ObjectId(userB);

  const existing = await this.chatRoomModel
    .findOne({
      type: 'DIRECT',
      members: { $all: [objUserA, objUserB] },
    })
    .populate('members', 'name username avatar') // <-- Make sure members are populated
    .exec();

  if (existing) return existing;

  const newRoom = await this.chatRoomModel.create({
    type: 'DIRECT',
    members: [objUserA, objUserB],
  });

  return newRoom.populate('members', 'name username avatar'); // <-- Populate new room members
}

  async getUserChatRooms(userId: string) {
    return this.chatRoomModel
      .find({ members: new Types.ObjectId(userId) })
      .populate('activity', 'title images')
      .populate('members', 'name avatar')
      .sort({ updatedAt: -1 })
      .exec();
  }


async saveMessage(chatRoomId: string, senderId: string, content: string) {
  const message = await this.messageModel.create({
    chatRoom: new Types.ObjectId(chatRoomId),
    sender: new Types.ObjectId(senderId),
    content,
  });

  const populated = await message.populate('sender', 'name avatar');
  return populated.toJSON(); // Converts Mongoose document to clean JSON
}

  async getMessages(chatRoomId: string) {
    return this.messageModel
      .find({ chatRoom: new Types.ObjectId(chatRoomId) })
      .populate('sender', 'name avatar')
      .sort({ createdAt: 1 })
      .exec();
  }
}