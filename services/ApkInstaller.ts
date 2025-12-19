import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

type ProgressCallback = (progress: number) => void;

const APK_FILE_NAME = 'syncre-update.apk';
const APK_MIME = 'application/vnd.android.package-archive';
const FLAG_GRANT_READ_URI_PERMISSION = 1;
const FLAG_ACTIVITY_NEW_TASK = 268435456; 
const INSTALL_FLAGS = FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK;

const getPackageId = () =>
	Constants.expoConfig?.android?.package ||
	(Constants.expoConfig as any)?.android?.package ||
	'com.devbeni.syncre';

const downloadDestination = () => `${FileSystem.cacheDirectory}${APK_FILE_NAME}`;

const cleanOldFile = async (uri: string) => {
	try {
		await FileSystem.deleteAsync(uri, { idempotent: true });
	} catch {
		// ignore
	}
};

const downloadApk = async (url: string, onProgress?: ProgressCallback): Promise<string> => {
	const destination = downloadDestination();
	await cleanOldFile(destination);

	const resumable = FileSystem.createDownloadResumable(
		url,
		destination,
		{},
		(status) => {
			if (onProgress) {
				const pct = status.totalBytesExpectedToWrite
					? status.totalBytesWritten / status.totalBytesExpectedToWrite
					: 0;
				onProgress(Math.min(Math.max(pct, 0), 1));
			}
		}
	);

	const result = await resumable.downloadAsync();
	if (!result?.uri) {
		throw new Error('Download failed');
	}

	return result.uri;
};

const launchInstaller = async (apkUri: string) => {
	if (Platform.OS !== 'android') {
		throw new Error('APK install is only supported on Android');
	}

	const contentUri = await FileSystem.getContentUriAsync(apkUri);
	try {
	await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
		data: contentUri,
		flags: INSTALL_FLAGS,
		type: APK_MIME,
	});
	} catch (error) {
		try {
			await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
				data: `package:${getPackageId()}`,
				flags: FLAG_ACTIVITY_NEW_TASK,
			});
		} catch {
			// ignore secondary failure
		}
		throw error;
	}
};

export const ApkInstaller = {
	async downloadAndInstall(url: string, onProgress?: ProgressCallback) {
		if (!url) {
			throw new Error('Missing APK download URL');
		}
		const apkUri = await downloadApk(url, onProgress);
		await launchInstaller(apkUri);
	},
};
