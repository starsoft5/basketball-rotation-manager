package expo.modules.bringtofront

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.ToneGenerator
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager

class BringToFrontService : Service() {
    private var handler: Handler? = null
    private var runnable: Runnable? = null
    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        handler = Handler(Looper.getMainLooper())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val delayMs = intent?.getLongExtra("delay_ms", 0L) ?: 0L

        createChannel()
        startForeground(NOTIF_ID, buildNotif())

        runnable?.let { handler?.removeCallbacks(it) }

        runnable = Runnable {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            @Suppress("DEPRECATION")
            wakeLock = pm.newWakeLock(
                PowerManager.FULL_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
                "basketball-rotation:countdown"
            )
            wakeLock?.acquire(15000)

            val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK or
                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                    Intent.FLAG_ACTIVITY_CLEAR_TOP or
                    Intent.FLAG_ACTIVITY_SINGLE_TOP
                )
                startActivity(launchIntent)
            }

            try {
                val toneGen = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
                toneGen.startTone(ToneGenerator.TONE_PROP_BEEP, 500)
            } catch (e: Exception) {}

            handler?.postDelayed({ stopSelf() }, 3000)
        }

        if (delayMs > 0) {
            handler?.postDelayed(runnable!!, delayMs)
        } else {
            handler?.post(runnable!!)
        }

        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        runnable?.let { handler?.removeCallbacks(it) }
        wakeLock?.let { if (it.isHeld) it.release() }
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
            .setContentText("Timer running")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    companion object {
        const val CH_ID = "rotation-bg"
        const val NOTIF_ID = 9999
    }
}
