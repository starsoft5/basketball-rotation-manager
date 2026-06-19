package expo.modules.bringtofront

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.speech.tts.TextToSpeech
import java.util.Locale

/**
 * Fired by BringToFrontReceiver when the rotation timer has 10 seconds left.
 * Speaks a native voice countdown "10, 9, ... 1" once per second, independent of
 * the React Native JS thread, so it works while the screen is off, the phone is
 * locked, or in power-save (and even if the app process was killed and cold-started
 * to deliver the alarm).
 *
 * Skips itself when the app is already in the foreground, because the JS timer
 * speaks the countdown in that case (avoids a double voice).
 */
class BringToFrontService : Service() {
    private var handler: Handler? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var hornPlayer: MediaPlayer? = null
    private var prevMusicVol = -1
    private var audioFocusRequest: AudioFocusRequest? = null

    override fun onCreate() {
        super.onCreate()
        handler = Handler(Looper.getMainLooper())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        createChannel()
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIF_ID, buildNotif(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SHORT_SERVICE)
        } else {
            startForeground(NOTIF_ID, buildNotif())
        }

        // App is visible and the JS timer is already speaking the countdown — do nothing.
        if (BringToFrontModule.appInForeground) {
            stopSelf()
            return START_NOT_STICKY
        }

        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "basketball-rotation:countdown"
        )
        wakeLock?.acquire(COUNT_FROM * 1000L + 3100L)

        tts = TextToSpeech(applicationContext) { status ->
            if (status == TextToSpeech.SUCCESS) {
                tts?.setLanguage(Locale.US)
                tts?.setSpeechRate(1.05f)
                ttsReady = true
            }
        }

        // Schedule one announcement per second: 10 (now), 9 (+1s) ... 1 (+9s).
        for (i in 0 until COUNT_FROM) {
            val number = COUNT_FROM - i
            handler?.postDelayed({ announce(number) }, i * 1000L)
        }
        // Rotation end + cleanup. Wait out the full horn (~2.5s) before stopping
        // so onDestroy doesn't release the MediaPlayer mid-blast.
        handler?.postDelayed({ beepFinal() }, COUNT_FROM * 1000L)
        handler?.postDelayed({ stopSelf() }, COUNT_FROM * 1000L + 2800L)

        return START_NOT_STICKY
    }

    private fun announce(n: Int) {
        if (ttsReady && tts != null) {
            val params = Bundle()
            params.putInt(TextToSpeech.Engine.KEY_PARAM_STREAM, AudioManager.STREAM_MUSIC)
            tts!!.speak(n.toString(), TextToSpeech.QUEUE_FLUSH, params, "count$n")
        } else {
            // TTS not ready yet (cold start) — still give a per-second audible cue.
            beep(150)
        }
    }

    private fun beep(durationMs: Int) {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, durationMs)
        } catch (e: Exception) {}
    }

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

    private fun playFallbackTone() {
        try {
            val tg = ToneGenerator(AudioManager.STREAM_MUSIC, ToneGenerator.MAX_VOLUME)
            tg.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500)
            handler?.postDelayed({ try { tg.release() } catch (e: Exception) {} }, 1800)
        } catch (e: Exception) {}
    }

    private fun beepFinal() {
        // Loud NBA-style game horn (res/raw/nba_horn) on the MUSIC stream — the same
        // stream the TTS countdown uses and is confirmed audible. (ALARM stream was
        // inaudible on devices where alarm volume is 0 and DND/permission blocks the
        // app from raising it.) Forces STREAM_MUSIC to max for the blast (restored on
        // completion), grabs transient audio focus so another app holding focus can't
        // silence it, and falls back to a synthesized tone if the MediaPlayer can't
        // load/play. Held on the field so it isn't cut short before stopSelf() frees it.
        val am = getSystemService(Context.AUDIO_SERVICE) as? AudioManager
        try {
            hornPlayer?.release()
            hornPlayer = null
            if (am != null) {
                try {
                    if (prevMusicVol < 0) prevMusicVol = am.getStreamVolume(AudioManager.STREAM_MUSIC)
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, am.getStreamMaxVolume(AudioManager.STREAM_MUSIC), 0)
                } catch (e: Exception) {}
                requestPlaybackFocus(am)
            }
            val resId = resources.getIdentifier("nba_horn", "raw", packageName)
            if (resId == 0) { playFallbackTone(); return }
            val mp = MediaPlayer()
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            val afd = resources.openRawResourceFd(resId)
            if (afd == null) { playFallbackTone(); restorePlayback(am); return }
            mp.setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
            afd.close()
            mp.setVolume(1f, 1f)
            mp.setOnCompletionListener {
                it.release()
                if (hornPlayer === it) hornPlayer = null
                restorePlayback(am)
            }
            mp.setOnErrorListener { p, _, _ ->
                try { p.release() } catch (e: Exception) {}
                if (hornPlayer === p) hornPlayer = null
                playFallbackTone()
                restorePlayback(am)
                true
            }
            mp.setOnPreparedListener { it.start() }
            mp.prepareAsync()
            hornPlayer = mp
        } catch (e: Exception) {
            playFallbackTone()
            restorePlayback(am)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler?.removeCallbacksAndMessages(null)
        wakeLock?.let { if (it.isHeld) it.release() }
        tts?.stop()
        tts?.shutdown()
        tts = null
        hornPlayer?.release()
        hornPlayer = null
        val nm = getSystemService(NotificationManager::class.java)
        nm.cancel(NOTIF_ID)
        super.onDestroy()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CH_ID, "Timer", NotificationManager.IMPORTANCE_MIN).apply {
                setShowBadge(false)
                setSound(null, null)
            }
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildNotif(): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CH_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("Basketball Rotation")
            .setContentText("Final 10 seconds")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CH_ID = "rotation-bg"
        const val NOTIF_ID = 9999
        const val COUNT_FROM = 10
    }
}
