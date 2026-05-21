package expo.modules.apkshare

import android.content.Context
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
            val destFile = File(cacheDir, "Basketball-Rotation.apk")

            FileInputStream(apkFile).use { input ->
                FileOutputStream(destFile).use { output ->
                    input.copyTo(output)
                }
            }

            destFile.absolutePath
        }
    }
}
