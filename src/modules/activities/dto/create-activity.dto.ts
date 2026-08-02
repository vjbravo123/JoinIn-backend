import {
  IsString,
  IsNumber,
  IsDateString,
  IsOptional,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export class CreateActivityDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  category: string;

  @IsString()
  @IsNotEmpty()
  locationName: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsDateString()
  eventDate: string;

  @IsOptional()
  @IsNumber()
  maxParticipants?: number;

  // Added images validation for frontend URLs
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}