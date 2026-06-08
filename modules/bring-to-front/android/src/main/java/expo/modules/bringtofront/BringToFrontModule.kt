package expo.modules.bringtofront

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.speech.tts.TextToSpeech
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.Locale

class BringToFrontModule : Module() {
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsInitializing = false
    private var ttsInitResult = "not started"
    private var mediaPlayer: MediaPlayer? = null

    private fun initTts(context: Context) {
        if (ttsReady || ttsInitializing) return
        ttsInitializing = true
        ttsInitResult = "initializing"
        tts = TextToSpeech(context.applicationContext) { status ->
            ttsInitializing = false
            if (status == TextToSpeech.SUCCESS) {
                val langResult = tts?.setLanguage(Locale.US)
                tts?.setSpeechRate(1.1f)
                ttsReady = true
                ttsInitResult = "success, lang=$langResult"
            } else {
                ttsInitResult = "failed, status=$status"
            }
        }
    }

    private fun alarmPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, BringToFrontReceiver::class.java).apply {
            action = "expo.modules.bringtofront.BRING_TO_FRONT"
        }
        var flags = PendingIntent.FLAG_UPDATE_CURRENT
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags = flags or PendingIntent.FLAG_IMMUTABLE
        }
        return PendingIntent.getBroadcast(context.applicationContext, ALARM_REQUEST_CODE, intent, flags)
    }

    override fun definition() = ModuleDefinition {
        Name("BringToFront")

        OnActivityEntersForeground {
            appInForeground = true
        }

        OnActivityEntersBackground {
            appInForeground = false
        }

        OnCreate {
            val ctx = appContext.reactContext
            if (ctx != null) {
                initTts(ctx)
            }
        }

        OnDestroy {
            tts?.stop()
            tts?.shutdown()
            tts = null
            ttsReady = false
            ttsInitializing = false
            mediaPlayer?.release()
            mediaPlayer = null
        }

        AsyncFunction("getTtsStatus") {
            "ready=$ttsReady, init=$ttsInitializing, result=$ttsInitResult"
        }

        AsyncFunction("getVolume") {
            val context = appContext.reactContext ?: return@AsyncFunction "no context"
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val musicVol = am.getStreamVolume(AudioManager.STREAM_MUSIC)
            val musicMax = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val alarmVol = am.getStreamVolume(AudioManager.STREAM_ALARM)
            val alarmMax = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val ringVol = am.getStreamVolume(AudioManager.STREAM_RING)
            val ringMax = am.getStreamMaxVolume(AudioManager.STREAM_RING)
            "Music: $musicVol/$musicMax, Alarm: $alarmVol/$alarmMax, Ring: $ringVol/$ringMax"
        }

        AsyncFunction("beep") { durationMs: Int ->
            try {
                val toneGen = android.media.ToneGenerator(AudioManager.STREAM_MUSIC, 100)
                toneGen.startTone(android.media.ToneGenerator.TONE_PROP_BEEP, durationMs)
                true
            } catch (e: Exception) {
                false
            }
        }

        AsyncFunction("beepFinal") {
            try {
                val toneGen = android.media.ToneGenerator(AudioManager.STREAM_MUSIC, 100)
                toneGen.startTone(android.media.ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 2000)
                true
            } catch (e: Exception) {
                false
            }
        }

        AsyncFunction("initTts") {
            val context = appContext.reactContext
            if (context != null) {
                initTts(context)
            }
            true
        }

        AsyncFunction("speak") { text: String ->
            val context = appContext.reactContext
            if (context != null && !ttsReady && !ttsInitializing) {
                initTts(context)
            }
            if (ttsReady && tts != null) {
                val params = android.os.Bundle()
                params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC)
                tts!!.speak(text, TextToSpeech.QUEUE_FLUSH, params, text)
            }
            true
        }

        AsyncFunction("stopSpeaking") {
            tts?.stop()
            true
        }

        AsyncFunction("bringToFront") {
            val context = appContext.reactContext
            if (context == null) return@AsyncFunction false

            val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!pm.isInteractive) {
                @Suppress("DEPRECATION")
                val wl = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK or
                    PowerManager.ACQUIRE_CAUSES_WAKEUP or
                    PowerManager.ON_AFTER_RELEASE,
                    "basketball-rotation:wake"
                )
                wl.acquire(5000)
            }

            val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (intent != null) {
                intent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
                context.startActivity(intent)
            }
            true
        }

        AsyncFunction("canOverlay") {
            val context = appContext.reactContext
            if (context == null) return@AsyncFunction true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(context)
            } else {
                true
            }
        }

        AsyncFunction("openOverlaySettings") {
            val context = appContext.reactContext
            if (context != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:${context.packageName}")
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                context.startActivity(intent)
            }
            true
        }

        // Schedule an exact, Doze-exempt alarm that fires `seconds` from now and
        // wakes the screen + brings the app to front via BringToFrontReceiver.
        // Runs through the OS AlarmManager, so it fires even when the JS thread is
        // suspended (app backgrounded, screen locked, or in power-save).
        AsyncFunction("scheduleAlarm") { seconds: Int ->
            val context = appContext.reactContext ?: return@AsyncFunction false
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val triggerAt = System.currentTimeMillis() + seconds * 1000L
            val pi = alarmPendingIntent(context)
            am.cancel(pi)
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !am.canScheduleExactAlarms()) {
                    // Exact-alarm permission revoked by user; fall back to inexact (still wakes from idle).
                    am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                } else {
                    am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
                }
            } catch (e: SecurityException) {
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi)
            }
            true
        }

        AsyncFunction("cancelAlarm") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.cancel(alarmPendingIntent(context))
            true
        }

        AsyncFunction("isIgnoringBatteryOptimizations") {
            val context = appContext.reactContext ?: return@AsyncFunction true
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
                pm.isIgnoringBatteryOptimizations(context.packageName)
            } else {
                true
            }
        }

        AsyncFunction("requestIgnoreBatteryOptimizations") {
            val context = appContext.reactContext ?: return@AsyncFunction false
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:${context.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    context.startActivity(intent)
                } catch (e: Exception) {}
            }
            true
        }
    }

    companion object {
        private const val ALARM_REQUEST_CODE = 1001

        // Set from the Activity lifecycle; read by BringToFrontService to decide
        // whether the JS timer is already handling the spoken countdown.
        @Volatile
        @JvmStatic
        var appInForeground: Boolean = false
    }
}
