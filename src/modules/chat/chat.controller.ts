import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('chats')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get()
  getUserChats(@CurrentUser('id') userId: string) {
    return this.chatService.getUserChatRooms(userId);
  }

  @Post('direct')
  createDirectChat(@CurrentUser('id') userId: string, @Body('recipientId') recipientId: string) {
    return this.chatService.getOrCreateDirectChat(userId, recipientId);
  }

  @Get(':chatRoomId/messages')
  getMessages(@Param('chatRoomId') chatRoomId: string) {
    return this.chatService.getMessages(chatRoomId);
  }
}