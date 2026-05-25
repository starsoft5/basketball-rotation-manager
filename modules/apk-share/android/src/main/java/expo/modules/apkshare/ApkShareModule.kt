package expo.modules.apkshare

import android.content.Intent
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class ApkShareModule : Module() {
    override fun definition() = ModuleDefinition {
        Name("ApkShare")

        AsyncFunction("getApkPath") {
            val context = appContext.reactContext ?: throw Exception("Context not available")
            val sourceDir = context.applicationInfo.sourceDir
            val apkFile = File(sourceDir)
            if (!apkFile.exists()) throw Exception("APK not found at $sourceDir")

            val cacheDir = context.cacheDir
            val destFile = File(cacheDir, "app-release.apk")

            FileInputStream(apkFile).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }

            destFile.absolutePath
        }

        AsyncFunction("shareApk") {
            val context = appContext.reactContext ?: throw Exception("Context not available")
            val sourceDir = context.applicationInfo.sourceDir
            val apkFile = File(sourceDir)
            if (!apkFile.exists()) throw Exception("APK not found at $sourceDir")

            val cacheDir = context.cacheDir
            val destFile = File(cacheDir, "app-release.apk")

            FileInputStream(apkFile).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }

            val authority = context.packageName + ".FileSystemFileProvider"
            val contentUri = FileProvider.getUriForFile(context, authority, destFile)

            val shareIntent = Intent(Intent.ACTION_SEND).apply {
                type = "application/vnd.android.package-archive"
                putExtra(Intent.EXTRA_STREAM, contentUri)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val chooser = Intent.createChooser(shareIntent, "Share Basketball Rotation").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(chooser)
        }
    }
}
