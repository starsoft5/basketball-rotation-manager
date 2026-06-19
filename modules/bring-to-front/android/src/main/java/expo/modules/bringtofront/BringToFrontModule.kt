package expo.modules.bringtofront

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
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
    private var prevMusicVol = -1
    private var audioFocusRequest: AudioFocusRequest? = null

    // Play the bundled NBA-style game horn (res/raw/nba_horn) on the MUSIC stream.
    // It used to play on the ALARM stream, but on devices where the alarm volume is
    // 0 and Do-Not-Disturb / a missing notification-policy permission silently blocks
    // the app from raising it, the horn played into a muted stream and was inaudible
    // even though the TTS countdown (which uses STREAM_MUSIC) was clearly audible.
    // So we now mirror the proven-working TTS path: force STREAM_MUSIC to max for the
    // blast (restored on completion) and play with USAGE_MEDIA. Transient audio focus
    // is grabbed so another app holding focus can't duck us into silence.
    private fun requestPlaybackFocus(am: AudioManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val attrs = AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
                val req = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
                    .setAudioAttributes(attrs)
                    .build()
                am.requestAudioFocus(req)
                audioFocusRequest = req
            } else {
                @Suppress("DEPRECATION")
                am.requestAudioFocus(null, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
            }
        } catch (e: Exception) {}
    }

    private fun abandonPlaybackFocus(am: AudioManager) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                audioFocusRequest?.let { am.abandonAudioFocusRequest(it) }
                audioFocusRequest = null
            } else {
                @Suppress("DEPRECATION")
                am.abandonAudioFocus(null)
            }
        } catch (e: Exception) {}
    }

    private fun restorePlayback(am: AudioManager?) {
        if (am == null) return
        if (prevMusicVol >= 0) {
            try { am.setStreamVolume(AudioManager.STREAM_MUSIC, prevMusicVol, 0) } catch (e: Exception) {}
            prevMusicVol = -1
        }
        abandonPlaybackFocus(am)
    }

    // Last-resort audible fallback: if the horn resource can't load or the
    // MediaPlayer errors, blast a synthesized tone on the MUSIC stream so the
    // rotation change is never silent. Released after it finishes so the
    // ToneGenerator doesn't leak.
    private fun playFallbackTone() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_MUSIC, ToneGenerator.MAX_VOLUME)
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500)
            Handler(Looper.getMainLooper()).postDelayed({
                try { tg.release() } catch (e: Exception) {}
            }, 1800)
        } catch (e: Exception) {}
    }

    // beepFinal() is dispatched on Expo's background thread, which has NO Looper.
    // MediaPlayer.prepareAsync()'s OnPreparedListener (which starts playback) and
    // OnCompletionListener only fire on a thread with a Looper, so run the whole
    // thing on the main thread — otherwise onPrepared never fires and the horn is
    // silent even though everything else (stream, volume, resource) is correct.
    private fun playHorn(context: Context) {
        Handler(Looper.getMainLooper()).post { playHornOnMainThread(context) }
    }

    private fun playHornOnMainThread(context: Context) {
        val am = context.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        try {
            mediaPlayer?.release()
            mediaPlayer = null
            if (am != null) {
                try {
                    if (prevMusicVol < 0) prevMusicVol = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0)
                } catch (e: Exception) {}
                requestPlaybackFocus(am)
            }
            val resId = context.resources.getIdentifier("nba_horn", "raw", context.packageName)
            if (resId == 0) { playFallbackTone(); return }
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            val afd = context.resources.openRawResourceFd(resId)
            if (afd == null) { playFallbackTone(); restorePlayback(am); return }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.setVolume(1f, 1f)
            mp.setOnCompletionListener {
                it.release()
                if (mediaPlayer === it) mediaPlayer = null
                restorePlayback(am)
            }
            mp.setOnErrorListener { p, _, _ ->
                try { p.release() } catch (e: Exception) {}
                if (mediaPlayer === p) mediaPlayer = null
                playFallbackTone()
                restorePlayback(am)
                true
            }
            // prepareAsync + start-on-prepared avoids any main-thread stall and
            // guarantees we only start once the source is actually ready.
            mp.setOnPreparedListener { it.start() }
            mp.prepareAsync()
            mediaPlayer = mp
        } catch (e: Exception) {
            playFallbackTone()
            restorePlayback(am)
        }
    }

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
            val context = appContext.reactContext ?: return@AsyncFunction false
            playHorn(context)
            true
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
