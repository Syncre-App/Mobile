import Constants from 'expo-constants';
import { ApkInstaller } from './ApkInstaller';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const appConfigJson = require('../app.json');
const resolvedAppConfig = appConfigJson?.expo ? appConfigJson : appConfigJson?.default || {};

export interface ReleaseInfo {
  version: string;
  notes: string;
  url: string;
  publishedAt?: string;
  assetUrl?: string;
  assetName?: string;
  assetSize?: number;
}

let pendingMandatoryUpdate: ReleaseInfo | null = null;

const RELEASE_ENDPOINT = 'https://api.github.com/repos/Syncre-App/Mobile/releases/latest';

const normalizeVersion = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const cleaned = value.trim().replace(/^v/i, '').replace(/^release[-/]/i, '');
  return cleaned || null;
};

const compareVersions = (current: string, latest: string): number => {
  const currentParts = current.split(/[.\-]/).map((part) => parseInt(part, 10) || 0);
  const latestParts = latest.split(/[.\-]/).map((part) => parseInt(part, 10) || 0);
  const max = Math.max(currentParts.length, latestParts.length);
  for (let i = 0; i < max; i += 1) {
    const a = currentParts[i] || 0;
    const b = latestParts[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
};

export const UpdateService = {
  getCurrentVersion(): string {
    const staticVersion =
      (resolvedAppConfig as any)?.expo?.version ||
      (resolvedAppConfig as any)?.version ||
      (Constants.expoConfig?.extra as any)?.appVersion ||
      null;

    return (
      (Constants.expoConfig?.version as string | undefined) ||
      staticVersion ||
      '0.0.0'
    );
  },

  async fetchLatestRelease(): Promise<ReleaseInfo | null> {
    try {
      const response = await fetch(RELEASE_ENDPOINT, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'syncre-mobile-app',
        },
      });

      if (!response.ok) {
        return null;
      }

      const payload = await response.json();
      const version = normalizeVersion(payload?.tag_name || payload?.name);
      if (!version) {
        return null;
      }

      const assets = Array.isArray(payload?.assets) ? payload.assets : [];
      const apkAsset =
        assets.find((asset: any) => asset?.name?.toLowerCase?.().endsWith('.apk')) ||
        assets.find((asset: any) => asset?.content_type === 'application/vnd.android.package-archive');

      return {
        version,
        notes: payload?.body || 'New version available.',
        url: payload?.html_url || 'https://github.com/Syncre-App/Mobile/releases/latest',
        publishedAt: payload?.published_at,
        assetUrl: apkAsset?.browser_download_url,
        assetName: apkAsset?.name,
        assetSize: apkAsset?.size,
      };
    } catch (error) {
      console.warn('[UpdateService] Failed to fetch latest release:', error);
      return null;
    }
  },

  async downloadAndInstallLatest(onProgress?: (progress: number) => void) {
    const latestRelease = await this.fetchLatestRelease();
    if (!latestRelease?.assetUrl) {
      throw new Error('No APK asset found in the latest release');
    }
    await ApkInstaller.downloadAndInstall(latestRelease.assetUrl, onProgress);
  },

  async checkForMandatoryUpdate(): Promise<{ requiresUpdate: boolean; release?: ReleaseInfo | null }> {
    const currentVersion = this.getCurrentVersion();
    const latestRelease = await this.fetchLatestRelease();
    if (!latestRelease) {
      return { requiresUpdate: false };
    }

    const isOutdated = compareVersions(currentVersion, latestRelease.version) < 0;
    if (isOutdated) {
      pendingMandatoryUpdate = latestRelease;
      return { requiresUpdate: true, release: latestRelease };
    }

    return { requiresUpdate: false };
  },

  consumePendingUpdate(): ReleaseInfo | null {
    const data = pendingMandatoryUpdate;
    pendingMandatoryUpdate = null;
    return data;
  },
};
