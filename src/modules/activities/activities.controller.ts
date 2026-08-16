import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/create-activity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly activitiesService: ActivitiesService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateActivityDto) {
    return this.activitiesService.createActivity(userId, dto);
  }

  @Get()
  findAll(
    @Query('category') category?: string,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
  ) {
    return this.activitiesService.findAll(
      category,
      lat !== undefined ? Number(lat) : undefined,
      lng !== undefined ? Number(lng) : undefined,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.activitiesService.findOne(id);
  }

  @Post(':id/join')
  join(@CurrentUser('id') userId: string, @Param('id') activityId: string) {
    return this.activitiesService.joinActivity(userId, activityId);
  }
}