import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const FLAG_GRANT_READ_URI_PERMISSION = 0x1;

const getDownloadDestination = () => {
  if (FileSystem.cacheDirectory) {
    return `${FileSystem.cacheDirectory}syncre-update-${Date.now()}.apk`;
  }
  if (FileSystem.documentDirectory) {
    return `${FileSystem.documentDirectory}syncre-update-${Date.now()}.apk`;
  }
  return null;
};

export const ApkInstaller = {
  async downloadAndInstall(url: string, onProgress?: (progress: number) => void) {
    if (Platform.OS !== 'android') {
      await Linking.openURL(url);
      return;
    }

    const destination = getDownloadDestination();
    if (!destination) {
      throw new Error('Unable to resolve a download destination.');
    }

    const downloadResumable = FileSystem.createDownloadResumable(
      url,
      destination,
      { headers: { Accept: 'application/vnd.android.package-archive' } },
      ({ totalBytesWritten, totalBytesExpectedToWrite }) => {
        if (!onProgress || !totalBytesExpectedToWrite) {
          return;
        }
        onProgress(totalBytesWritten / totalBytesExpectedToWrite);
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result?.uri) {
      throw new Error('Failed to download update package.');
    }

    const contentUri = await FileSystem.getContentUriAsync(result.uri);
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: 'application/vnd.android.package-archive',
    });
  },
};
