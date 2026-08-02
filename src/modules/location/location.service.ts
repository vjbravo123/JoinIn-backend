import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class LocationService {
  private readonly baseUrl = 'https://api.olamaps.io/places/v1';
  private readonly apiKey = process.env.OLA_MAPS_API_KEY;

  /**
   * Get location search autocomplete suggestions from Ola Maps
   */
  async getAutocomplete(input: string) {
    if (!input || input.trim().length === 0) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/autocomplete`, {
        params: { input, api_key: this.apiKey },
        headers: {
            Referer: 'https://joinin-backend-x11z.onrender.com',
            // some APIs check Origin instead — try adding both if unsure
            Origin: 'https://joinin-backend-x11z.onrender.com',
        },
        });

      // Ola Maps returns predictions array
      const predictions = response.data?.predictions || response.data?.data || [];

      return predictions.map((item: any) => ({
        place_id: item.place_id || item.id,
        main_text: item.structured_formatting?.main_text || item.description,
        secondary_text: item.structured_formatting?.secondary_text || '',
        description: item.description,
        latitude: item.geometry?.location?.lat ?? item.lat ?? null,
        longitude: item.geometry?.location?.lng ?? item.lng ?? null,
      }));
    } catch (error: any) {
      console.error('Ola Maps Autocomplete Error:', error.response?.data || error.message);
      throw new HttpException(
        error.response?.data?.message || 'Failed to fetch location suggestions',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Get details or coordinates for a selected place ID
   */
  async getPlaceDetails(placeId: string) {
    try {
      const response = await axios.get(`${this.baseUrl}/details`, {
        params: {
          place_id: placeId,
          api_key: this.apiKey,
        },
      });

      const result = response.data?.result || response.data?.data || {};
      const location = result.geometry?.location || {};

      return {
        place_id: placeId,
        name: result.name || result.formatted_address,
        formatted_address: result.formatted_address || '',
        latitude: location.lat,
        longitude: location.lng,
      };
    } catch (error: any) {
      console.error('Ola Maps Details Error:', error.response?.data || error.message);
      throw new HttpException('Failed to fetch place details', HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Reverse Geocode (Get location name/address from Lat/Lng)
   */
  async reverseGeocode(lat: number, lng: number) {
    try {
      const response = await axios.get(`${this.baseUrl}/reverse-geocode`, {
        params: {
          latlng: `${lat},${lng}`,
          api_key: this.apiKey,
        },
      });

      const results = response.data?.results || [];
      const topResult = results[0] || {};

      return {
        formatted_address: topResult.formatted_address || 'Selected Location',
        latitude: lat,
        longitude: lng,
      };
    } catch (error: any) {
      console.error('Ola Maps Reverse Geocode Error:', error.response?.data || error.message);
      return {
        formatted_address: `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        latitude: lat,
        longitude: lng,
      };
    }
  }
}