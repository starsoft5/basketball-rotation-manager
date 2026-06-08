package expo.modules.bringtofront

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioManager
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
        wakeLock?.acquire(COUNT_FROM * 1000L + 3000L)

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
        // Rotation end + cleanup.
        handler?.postDelayed({ beepFinal() }, COUNT_FROM * 1000L)
        handler?.postDelayed({ stopSelf() }, COUNT_FROM * 1000L + 1500L)

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

    private fun beepFinal() {
        try {
            val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGen.startTone(ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, 1500)
        } catch (e: Exception) {}
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        handler?.removeCallbacksAndMessages(null)
        wakeLock?.let { if (it.isHeld) it.release() }
        tts?.stop()
        tts?.shutdown()
        tts = null
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
