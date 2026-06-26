package expo.modules.scoreboarddisplay

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.DisplayMetrics
import android.util.TypedValue
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.view.WindowManager
import android.widget.LinearLayout
import android.widget.TextView

/**
 * A clean, full-screen LED scoreboard rendered on an external display. The phone
 * keeps the control UI; this only mirrors the live values pushed via applyState().
 */
class ScoreboardPresentation(context: Context, display: Display) : Presentation(context, display) {

    private lateinit var clockTv: TextView
    private lateinit var homeTv: TextView
    private lateinit var guestTv: TextView
    private lateinit var hFoulTv: TextView
    private lateinit var gFoulTv: TextView
    private lateinit var hBonusTv: TextView
    private lateinit var gBonusTv: TextView
    private lateinit var shotTv: TextView
    private lateinit var possLeft: TextView
    private lateinit var possRight: TextView
    private val periodNums = ArrayList<TextView>()
    private val hToDots = ArrayList<View>()
    private val gToDots = ArrayList<View>()

    private val cBg = Color.parseColor("#0A0A0A")
    private val cClock = Color.parseColor("#F4F4F4")
    private val cClockOff = Color.parseColor("#8A8A8A")
    private val cScore = Color.parseColor("#FFB200")
    private val cFoul = Color.parseColor("#FF3B30")
    private val cShot = Color.parseColor("#FF7A1A")
    private val cTo = Color.parseColor("#27C24C")
    private val cToOff = Color.parseColor("#243024")
    private val cLabel = Color.parseColor("#9AA0A6")
    private val cTeam = Color.parseColor("#E6E6E6")
    private val cDim = Color.parseColor("#3A3A3A")

    private val MP = ViewGroup.LayoutParams.MATCH_PARENT
    private val WC = ViewGroup.LayoutParams.WRAP_CONTENT

    private val TO_DOTS = 3            // max timeouts a team can hold at once (FIBA 2nd half)
    private val BONUS_OFF_ALPHA = 0.12f // dimmed BONUS light when not in the penalty

    // Fresh-game board shown the moment the display opens, before JS pushes state.
    private val DEFAULT_STATE: Map<String, Any?> = mapOf(
        "clock" to "10:00",
        "running" to false,
        "shot" to 24, "shotOff" to false,
        "home" to 0, "guest" to 0,
        "hFoul" to 0, "gFoul" to 0,
        "hBonus" to false, "gBonus" to false,
        "hTO" to 2, "gTO" to 2, "toMax" to 2,  // FIBA first half: 2 timeouts
        "period" to 1,
        "poss" to "home",
    )

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val metrics = DisplayMetrics()
        @Suppress("DEPRECATION")
        display.getRealMetrics(metrics)
        val h = metrics.heightPixels.toFloat()
        setContentView(buildRoot(context, h))

        // First open: render the fresh-game board immediately (10:00 · 0–0 · P1 ·
        // Sht Clk 24 · home possession) so it never flashes blank before JS pushes
        // the first real state. The next applyState() simply overwrites these.
        applyState(DEFAULT_STATE)

        // Immersive fullscreen so the external display shows ONLY the board — no
        // Samsung status bar, navigation bar or taskbar framing it.
        hideSystemBars()
        // Re-apply once the window is attached (the insets controller can be a no-op
        // before then) and again whenever the bars sneak back in, so the footer stays
        // gone for the whole session rather than just at first paint.
        window?.decorView?.let { dv ->
            dv.post { hideSystemBars() }
            @Suppress("DEPRECATION")
            dv.setOnSystemUiVisibilityChangeListener { vis ->
                if (vis and View.SYSTEM_UI_FLAG_FULLSCREEN == 0) hideSystemBars()
            }
        }
    }

    /** Drive both the modern (API 30+) and legacy paths to hide the status/nav bars. */
    private fun hideSystemBars() {
        window?.let { w ->
            w.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // API 30+ (incl. Android 16): the legacy systemUiVisibility flags are
                // ignored, so the nav/status bars leak in. Drive the modern controller.
                w.setDecorFitsSystemWindows(false)
                w.insetsController?.let { c ->
                    c.hide(WindowInsets.Type.systemBars())
                    c.systemBarsBehavior =
                        WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                }
            }
            // Keep the legacy flags too — harmless on API 30+ and required on older.
            @Suppress("DEPRECATION")
            w.decorView.systemUiVisibility = (
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or
                View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_FULLSCREEN or
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            )
        }
    }

    private fun led(ctx: Context, px: Float, color: Int): TextView {
        val t = TextView(ctx)
        t.setTextColor(color)
        t.typeface = Typeface.create(Typeface.MONOSPACE, Typeface.BOLD)
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, px)
        t.includeFontPadding = false
        t.gravity = Gravity.CENTER
        t.setShadowLayer(px * 0.18f, 0f, 0f, color)
        return t
    }

    private fun label(ctx: Context, text: String, px: Float, color: Int): TextView {
        val t = TextView(ctx)
        t.text = text
        t.setTextColor(color)
        t.typeface = Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD)
        t.setTextSize(TypedValue.COMPLEX_UNIT_PX, px)
        t.letterSpacing = 0.15f
        t.gravity = Gravity.CENTER
        return t
    }

    private fun dotDrawable(color: Int): GradientDrawable {
        val g = GradientDrawable()
        g.shape = GradientDrawable.OVAL
        g.setColor(color)
        return g
    }

    private fun weighted(weight: Float): LinearLayout.LayoutParams =
        LinearLayout.LayoutParams(0, WC, weight)

    private fun buildRoot(ctx: Context, h: Float): View {
        val root = LinearLayout(ctx)
        root.orientation = LinearLayout.VERTICAL
        root.setBackgroundColor(cBg)
        // Maximize the usable width: keep a small vertical margin but let the board
        // run nearly edge-to-edge horizontally so the clock/scores get the full width.
        val padV = (h * 0.03f).toInt()
        val padH = (h * 0.012f).toInt()
        root.setPadding(padH, padV, padH, padV)
        root.gravity = Gravity.CENTER_VERTICAL

        // ---- TOP: corners + clock ----
        val top = LinearLayout(ctx)
        top.orientation = LinearLayout.HORIZONTAL
        top.gravity = Gravity.CENTER_VERTICAL
        top.layoutParams = LinearLayout.LayoutParams(MP, 0, 1f)

        top.addView(buildCorner(ctx, h, true))
        clockTv = led(ctx, h * 0.40f, cClock)
        clockTv.maxLines = 1
        clockTv.layoutParams = LinearLayout.LayoutParams(0, WC, 3.4f)
        // Auto-shrink the clock to fit its column on one line, so a 5-char value like
        // "10:00" always renders in full instead of being clipped to "10:0" on a wide,
        // short external display. (The native equivalent of the JS adjustsFontSizeToFit.)
        clockTv.setAutoSizeTextTypeUniformWithConfiguration(
            (h * 0.14f).toInt().coerceAtLeast(12),
            (h * 0.40f).toInt(),
            2,
            TypedValue.COMPLEX_UNIT_PX,
        )
        top.addView(clockTv)
        top.addView(buildCorner(ctx, h, false))
        root.addView(top)

        // ---- BOTTOM: scores + period + shot clock ----
        val bottom = LinearLayout(ctx)
        bottom.orientation = LinearLayout.HORIZONTAL
        bottom.gravity = Gravity.CENTER_VERTICAL
        bottom.layoutParams = LinearLayout.LayoutParams(MP, 0, 1.25f)

        bottom.addView(buildTeamCol(ctx, h, "HOME", true))
        bottom.addView(buildCenterCol(ctx, h))
        bottom.addView(buildTeamCol(ctx, h, "GUEST", false))
        root.addView(bottom)

        return root
    }

    private fun buildCorner(ctx: Context, h: Float, isLeft: Boolean): View {
        val col = LinearLayout(ctx)
        col.orientation = LinearLayout.VERTICAL
        col.gravity = Gravity.CENTER
        col.layoutParams = weighted(1f)

        val poss = led(ctx, h * 0.075f, cFoul)
        poss.text = if (isLeft) "◀" else "▶"
        if (isLeft) possLeft = poss else possRight = poss
        col.addView(poss)

        col.addView(label(ctx, "T.O.", h * 0.044f, cTo))

        val dots = LinearLayout(ctx)
        dots.orientation = LinearLayout.HORIZONTAL
        dots.gravity = Gravity.CENTER
        val dotSize = (h * 0.022f).toInt()
        val gap = (h * 0.006f).toInt()
        val list = if (isLeft) hToDots else gToDots
        for (i in 0 until TO_DOTS) {
            val d = View(ctx)
            val lp = LinearLayout.LayoutParams(dotSize, dotSize)
            lp.setMargins(gap, (h * 0.01f).toInt(), gap, (h * 0.01f).toInt())
            d.layoutParams = lp
            d.background = dotDrawable(cToOff)
            dots.addView(d)
            list.add(d)
        }
        col.addView(dots)

        val foul = led(ctx, h * 0.11f, cFoul)
        if (isLeft) hFoulTv = foul else gFoulTv = foul
        col.addView(foul)

        col.addView(label(ctx, "FOULS", h * 0.038f, cFoul))

        // Penalty/bonus light — lit when this team has reached the foul limit for the period.
        val bonus = label(ctx, "BONUS", h * 0.038f, cFoul)
        bonus.alpha = BONUS_OFF_ALPHA
        if (isLeft) hBonusTv = bonus else gBonusTv = bonus
        col.addView(bonus)
        return col
    }

    private fun buildTeamCol(ctx: Context, h: Float, name: String, isHome: Boolean): View {
        val col = LinearLayout(ctx)
        col.orientation = LinearLayout.VERTICAL
        col.gravity = Gravity.CENTER
        col.layoutParams = weighted(1f)

        col.addView(label(ctx, name, h * 0.062f, cTeam))
        val score = led(ctx, h * 0.32f, cScore)
        if (isHome) homeTv = score else guestTv = score
        col.addView(score)
        return col
    }

    private fun buildCenterCol(ctx: Context, h: Float): View {
        val col = LinearLayout(ctx)
        col.orientation = LinearLayout.VERTICAL
        col.gravity = Gravity.CENTER
        col.layoutParams = weighted(1f)

        col.addView(label(ctx, "PERIOD", h * 0.044f, cLabel))
        val nums = LinearLayout(ctx)
        nums.orientation = LinearLayout.HORIZONTAL
        nums.gravity = Gravity.CENTER
        val m = (h * 0.012f).toInt()
        for (i in 1..4) {
            val t = led(ctx, h * 0.062f, cDim)
            t.text = i.toString()
            val lp = LinearLayout.LayoutParams(WC, WC)
            lp.setMargins(m, 0, m, 0)
            t.layoutParams = lp
            nums.addView(t)
            periodNums.add(t)
        }
        col.addView(nums)

        col.addView(label(ctx, "Shot Clock", h * 0.040f, cLabel))
        shotTv = led(ctx, h * 0.20f, cShot)
        col.addView(shotTv)
        return col
    }

    private fun setGlow(tv: TextView, color: Int, on: Boolean) {
        tv.setTextColor(color)
        tv.setShadowLayer(if (on) tv.textSize * 0.18f else 0f, 0f, 0f, color)
    }

    fun applyState(s: Map<String, Any?>) {
        fun num(k: String): Int = (s[k] as? Number)?.toInt() ?: 0
        val running = (s["running"] as? Boolean) ?: false

        clockTv.text = s["clock"]?.toString() ?: "0:00"
        setGlow(clockTv, if (running) cClock else cClockOff, true)

        homeTv.text = num("home").toString()
        guestTv.text = num("guest").toString()
        hFoulTv.text = num("hFoul").toString()
        gFoulTv.text = num("gFoul").toString()

        // Shot clock: hidden (blank) once the game clock has less time left than it.
        val shot = num("shot")
        val shotOff = (s["shotOff"] as? Boolean) ?: false
        if (shotOff) {
            shotTv.text = ""
            setGlow(shotTv, cDim, false)
        } else {
            shotTv.text = String.format("%02d", shot)
            setGlow(shotTv, if (shot == 0) cFoul else cShot, true)
        }

        // Timeout dots: show only this half's allotment (toMax), filled = remaining.
        val toMax = (s["toMax"] as? Number)?.toInt() ?: TO_DOTS
        val hto = num("hTO")
        for (i in hToDots.indices) {
            hToDots[i].visibility = if (i < toMax) View.VISIBLE else View.GONE
            (hToDots[i].background as? GradientDrawable)?.setColor(if (i < hto) cTo else cToOff)
        }
        val gto = num("gTO")
        for (i in gToDots.indices) {
            gToDots[i].visibility = if (i < toMax) View.VISIBLE else View.GONE
            (gToDots[i].background as? GradientDrawable)?.setColor(if (i < gto) cTo else cToOff)
        }

        // Penalty/bonus lights.
        hBonusTv.alpha = if ((s["hBonus"] as? Boolean) == true) 1f else BONUS_OFF_ALPHA
        gBonusTv.alpha = if ((s["gBonus"] as? Boolean) == true) 1f else BONUS_OFF_ALPHA

        val per = num("period")
        for (i in periodNums.indices) {
            val on = (i + 1) == per
            setGlow(periodNums[i], if (on) cShot else cDim, on)
        }

        val poss = s["poss"]?.toString() ?: "home"
        possLeft.alpha = if (poss == "home") 1f else 0.12f
        possRight.alpha = if (poss == "guest") 1f else 0.12f
    }
}
