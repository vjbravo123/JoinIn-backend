import { Controller, Get, Patch, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('me')
  updateProfile(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      username?: string;
      name?: string;
      bio?: string;
      avatar?: string;
      interests?: string[];
    },
  ) {
    return this.usersService.updateProfile(userId, body);
  }

  @Get('me/hosted-activities')
  getHostedActivities(@CurrentUser('id') userId: string) {
    return this.usersService.getHostedActivities(userId);
  }

  @Get('me/joined-activities')
  getJoinedActivities(@CurrentUser('id') userId: string) {
    return this.usersService.getJoinedActivities(userId);
  }
}