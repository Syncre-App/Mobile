const DEFAULT_TIMEZONE = 'Europe/Budapest';

let cachedTimezone: string | null = null;

const hasIntl = typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function';

const detectTimezone = (): string => {
  if (!hasIntl) {
    return DEFAULT_TIMEZONE;
  }

  try {
    const resolved = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (resolved && resolved !== 'Etc/Unknown') {
      return resolved;
    }
  } catch (error) {
    console.warn('TimezoneService: failed to resolve via Intl API', error);
  }

  return DEFAULT_TIMEZONE;
};

export const TimezoneService = {
  getTimezone(forceRefresh = false): string {
    if (!cachedTimezone || forceRefresh) {
      cachedTimezone = detectTimezone() || DEFAULT_TIMEZONE;
    }
    return cachedTimezone;
  },

  refreshFromDevice(): string {
    cachedTimezone = detectTimezone() || DEFAULT_TIMEZONE;
    return cachedTimezone;
  },

  setTimezone(timezone?: string | null): string {
    if (timezone && typeof timezone === 'string' && timezone.trim().length) {
      cachedTimezone = timezone.trim();
    }
    return this.getTimezone();
  },

  applyHeader<T extends Record<string, string>>(headers: T): T {
    const timezone = this.getTimezone();
    if (timezone) {
      (headers as Record<string, string>)['X-Client-Timezone'] = timezone;
    }
    return headers;
  },
};
