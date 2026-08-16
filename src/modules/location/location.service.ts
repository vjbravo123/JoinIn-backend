import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import axios from 'axios';
import { randomUUID } from 'crypto';

@Injectable()
export class LocationService {
  private readonly baseUrl = 'https://api.olamaps.io/places/v1';
  private readonly apiKey = process.env.OLA_MAPS_API_KEY;

  /**
   * Helper to construct required headers for Ola Maps API
   */
  private getHeaders() {
    return {
      'X-Request-Id': randomUUID(),
      Referer: 'https://joinin-backend-x11z.onrender.com',
      Origin: 'https://joinin-backend-x11z.onrender.com',
    };
  }

  /**
   * Get location search autocomplete suggestions from Ola Maps
   */
  async getAutocomplete(input: string) {
    if (!input || input.trim().length === 0) {
      return [];
    }

    try {
      const response = await axios.get(`${this.baseUrl}/autocomplete`, {
        params: {
          input: input.trim(),
          api_key: this.apiKey,
        },
        headers: this.getHeaders(),
        timeout: 5000,
      });

      const predictions =
        response.data?.predictions || response.data?.data || [];

      return predictions.map((item: any) => ({
        place_id: item.place_id || item.id,
        main_text:
          item.structured_formatting?.main_text ||
          item.main_text ||
          item.description?.split(',')[0] ||
          item.description,
        secondary_text:
          item.structured_formatting?.secondary_text ||
          item.secondary_text ||
          '',
        description: item.description || item.main_text || '',
        latitude:
          item.geometry?.location?.lat ??
          item.lat ??
          item.latitude ??
          null,
        longitude:
          item.geometry?.location?.lng ??
          item.lng ??
          item.longitude ??
          null,
      }));
    } catch (error: any) {
      console.error(
        'Ola Maps Autocomplete Error:',
        error.response?.data || error.message,
      );
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
    if (!placeId) {
      throw new HttpException('Place ID is required', HttpStatus.BAD_REQUEST);
    }

    try {
      const response = await axios.get(`${this.baseUrl}/details`, {
        params: {
          place_id: placeId,
          api_key: this.apiKey,
        },
        headers: this.getHeaders(),
        timeout: 5000,
      });

      const result = response.data?.result || response.data?.data || {};
      const location = result.geometry?.location || {};

      const formatted_address =
        result.formatted_address || result.address || '';
      const name =
        result.name ||
        (formatted_address ? formatted_address.split(',')[0] : 'Selected Place');

      return {
        place_id: placeId,
        name,
        formatted_address,
        latitude: Number(location.lat ?? result.lat ?? result.latitude),
        longitude: Number(location.lng ?? result.lng ?? result.longitude),
      };
    } catch (error: any) {
      console.error(
        'Ola Maps Details Error:',
        error.response?.data || error.message,
      );
      throw new HttpException(
        error.response?.data?.message || 'Failed to fetch place details',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * Reverse Geocode (Get location name/address from Lat/Lng)
   */
  async reverseGeocode(lat: number, lng: number) {
    // 1. Primary: Ola Maps Reverse Geocode
    try {
      const response = await axios.get(`${this.baseUrl}/reverse-geocode`, {
        params: {
          latlng: `${lat},${lng}`,
          api_key: this.apiKey,
        },
        headers: this.getHeaders(),
        timeout: 5000,
      });

      const results =
        response.data?.results ||
        response.data?.data ||
        (response.data?.result ? [response.data.result] : []);

      if (results.length > 0) {
        const topResult = results[0];
        const formatted_address =
          topResult.formatted_address ||
          topResult.address ||
          topResult.name ||
          '';

        // Extract neighborhood/locality name for UI header display
        const localityName =
          topResult.name ||
          (topResult.address_components &&
            topResult.address_components.find((c: any) =>
              c.types?.some((t: string) =>
                ['sublocality', 'neighborhood', 'locality', 'sublocality_level_1'].includes(t),
              ),
            )?.long_name) ||
          (formatted_address ? formatted_address.split(',')[0] : 'Selected Location');

        return {
          name: localityName,
          formatted_address: formatted_address || localityName,
          latitude: lat,
          longitude: lng,
        };
      }
    } catch (error: any) {
      console.error(
        'Ola Maps Reverse Geocode Error:',
        error.response?.data || error.message,
      );
    }

    // 2. Reliable Fallback: OpenStreetMap (Nominatim)
    // Ensures real place names even if Ola quota/network fails
    try {
      const osmRes = await axios.get(
        'https://nominatim.openstreetmap.org/reverse',
        {
          params: {
            lat,
            lon: lng,
            format: 'json',
          },
          headers: {
            'User-Agent': 'JoinIn-App/1.0',
          },
          timeout: 4000,
        },
      );

      if (osmRes.data) {
        const addr = osmRes.data.address || {};
        const name =
          addr.suburb ||
          addr.neighbourhood ||
          addr.residential ||
          addr.city_district ||
          addr.city ||
          addr.town ||
          addr.village ||
          osmRes.data.name ||
          'Selected Location';

        return {
          name,
          formatted_address: osmRes.data.display_name || name,
          latitude: lat,
          longitude: lng,
        };
      }
    } catch (osmError: any) {
      console.error('OSM Reverse Geocode Fallback Error:', osmError.message);
    }

    // 3. Last-Resort Default (Never return raw coordinates)
    return {
      name: 'Current Area',
      formatted_address: 'Meetup Location',
      latitude: lat,
      longitude: lng,
    };
  }
}