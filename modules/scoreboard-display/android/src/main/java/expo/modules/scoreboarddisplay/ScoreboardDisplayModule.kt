package expo.modules.scoreboarddisplay

import android.content.Context
import android.hardware.display.DisplayManager
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class ScoreboardDisplayModule : Module() {

    private var presentation: ScoreboardPresentation? = null
    private val main = Handler(Looper.getMainLooper())
    private var displayListener: DisplayManager.DisplayListener? = null

    private fun displayManager(): DisplayManager? {
        val ctx: Context = appContext.reactContext ?: return null
        return ctx.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager
    }

    override fun definition() = ModuleDefinition {
        Name("ScoreboardDisplay")

        // List external (presentation) displays currently attached.
        AsyncFunction("getDisplays") {
            val dm = displayManager() ?: return@AsyncFunction emptyList<Map<String, Any>>()
            dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).map {
                mapOf("id" to it.displayId, "name" to (it.name ?: "Display ${it.displayId}"))
            }
        }

        // Start showing the scoreboard on the first external display.
        AsyncFunction("present") { state: Map<String, Any?> ->
            val activity = appContext.currentActivity
                ?: return@AsyncFunction mapOf("ok" to false, "reason" to "no_activity")
            val dm = displayManager()
                ?: return@AsyncFunction mapOf("ok" to false, "reason" to "no_display_manager")
            val displays = dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)
            if (displays.isEmpty()) {
                return@AsyncFunction mapOf("ok" to false, "reason" to "no_external_display")
            }
            // Present onto the NEWEST presentation display (highest id). A freshly created
            // scrcpy/cast display always has a higher id than any leftover "zombie" display,
            // so the board follows the real window instead of getting stuck on a dead one.
            val target = displays.maxByOrNull { it.displayId } ?: displays[0]
            var result: Map<String, Any?> = mapOf("ok" to false, "reason" to "unknown")
            val latch = CountDownLatch(1)
            main.post {
                try {
                    presentation?.dismiss()
                    val p = ScoreboardPresentation(activity, target)
                    p.setOnDismissListener { if (presentation === p) presentation = null }
                    p.show()
                    p.applyState(state)
                    presentation = p
                    registerDisplayListener(dm)
                    result = mapOf("ok" to true, "display" to (target.name ?: "external"))
                } catch (e: Exception) {
                    result = mapOf("ok" to false, "reason" to (e.message ?: "exception"))
                } finally {
                    latch.countDown()
                }
            }
            latch.await(3, TimeUnit.SECONDS)
            result
        }

        // Push fresh values to the live presentation (called on every change).
        AsyncFunction("update") { state: Map<String, Any?> ->
            main.post { presentation?.applyState(state) }
            true
        }

        AsyncFunction("dismiss") {
            main.post {
                presentation?.dismiss()
                presentation = null
            }
            true
        }

        OnDestroy {
            main.post {
                presentation?.dismiss()
                presentation = null
            }
        }
    }

    private fun registerDisplayListener(dm: DisplayManager) {
        if (displayListener != null) return
        val l = object : DisplayManager.DisplayListener {
            override fun onDisplayAdded(displayId: Int) {}
            override fun onDisplayChanged(displayId: Int) {}
            override fun onDisplayRemoved(displayId: Int) {
                main.post {
                    if (presentation?.display?.displayId == displayId) {
                        presentation?.dismiss()
                        presentation = null
                    }
                }
            }
        }
        dm.registerDisplayListener(l, main)
        displayListener = l
    }
}
