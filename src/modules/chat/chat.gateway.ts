import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  transports: ['polling', 'websocket'],
})
export class ChatGateway {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  @SubscribeMessage('joinRoom')
  handleJoinRoom(
    @MessageBody() data: { chatRoomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.chatRoomId) {
      client.join(data.chatRoomId);
      console.log(`Socket ${client.id} joined room ${data.chatRoomId}`);
    }
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @MessageBody() data: { chatRoomId: string },
    @ConnectedSocket() client: Socket,
  ) {
    if (data?.chatRoomId) {
      client.leave(data.chatRoomId);
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @MessageBody() data: { chatRoomId: string; senderId: string; content: string },
  ) {
    const message = await this.chatService.saveMessage(
      data.chatRoomId,
      data.senderId,
      data.content,
    );
    this.server.to(data.chatRoomId).emit('newMessage', message);
  }
}