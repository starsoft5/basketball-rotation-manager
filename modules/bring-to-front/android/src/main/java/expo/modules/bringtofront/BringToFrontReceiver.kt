package expo.modules.bringtofront

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.PowerManager

/**
 * Triggered by the exact AlarmManager alarm when 10 seconds remain in a rotation.
 * Wakes the screen, brings the app to front (over the lock screen), and starts the
 * foreground service that speaks the native 10->1 countdown. Works even if the app
 * process was killed: the system restarts it to deliver this manifest-declared broadcast.
 */
class BringToFrontReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
        @Suppress("DEPRECATION")
        val wakeLock = pm.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
            PowerManager.ACQUIRE_CAUSES_WAKEUP or
            PowerManager.ON_AFTER_RELEASE,
            "basketball-rotation:rotation-end"
        )
        wakeLock.acquire(5000)

        val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
        if (launchIntent != null) {
            launchIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK or
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT or
                Intent.FLAG_ACTIVITY_CLEAR_TOP or
                Intent.FLAG_ACTIVITY_SINGLE_TOP
            )
            context.startActivity(launchIntent)
        }

        val serviceIntent = Intent(context, BringToFrontService::class.java)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        } catch (e: Exception) {}
    }
}
