import { requireNativeModule } from "expo-modules-core";

const ApkShare = requireNativeModule("ApkShare");

export async function getApkPath() {
  return ApkShare.getApkPath();
}

export async function shareApk() {
  return ApkShare.shareApk();
}
