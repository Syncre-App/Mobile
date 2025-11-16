import * as Location from 'expo-location';
import * as Localization from 'expo-localization';

import { ApiService } from './ApiService';
import { StorageService } from './StorageService';
import { TimezoneService } from './TimezoneService';

const resolveDeviceTimezone = (): string => {
  try {
    const calendars = Localization.getCalendars?.();
    if (Array.isArray(calendars) && calendars.length) {
      const candidate = calendars[0]?.timeZone;
      if (candidate && candidate !== 'Etc/Unknown') {
        return candidate;
      }
    }
  } catch (error) {
    console.warn('LocationSyncService: failed to resolve timezone via Localization', error);
  }
  return TimezoneService.refreshFromDevice();
};

export const LocationSyncService = {
  async sync(): Promise<void> {
    try {
      const token = await StorageService.getAuthToken();
      if (!token) {
        TimezoneService.refreshFromDevice();
        return;
      }

      const timezone = resolveDeviceTimezone();
      TimezoneService.setTimezone(timezone);

      let coords: { latitude: number; longitude: number } | null = null;
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (
          permission.status === Location.PermissionStatus.GRANTED ||
          permission.status === 'granted'
        ) {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Lowest,
          });
          coords = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch (locationError) {
        console.warn('LocationSyncService: location request failed', locationError);
      }

      await ApiService.post(
        '/user/location',
        {
          latitude: coords?.latitude ?? null,
          longitude: coords?.longitude ?? null,
          timezone,
        },
        token
      );
    } catch (error) {
      console.warn('LocationSyncService: sync failed', error);
      TimezoneService.refreshFromDevice();
    }
  },
};
