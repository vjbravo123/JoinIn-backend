import { Controller, Get, Query } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('location')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('autocomplete')
  async autocomplete(@Query('input') input: string) {
    return this.locationService.getAutocomplete(input);
  }

  @Get('details')
  async getPlaceDetails(@Query('place_id') placeId: string) {
    return this.locationService.getPlaceDetails(placeId);
  }

  @Get('reverse-geocode')
  async reverseGeocode(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
  ) {
    return this.locationService.reverseGeocode(parseFloat(lat), parseFloat(lng));
  }
}