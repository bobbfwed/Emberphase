package com.bobbfwed.emberphase.health.watch;

import android.annotation.SuppressLint;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.content.res.Resources;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/**
 * Event-driven low-light signal from the screen-brightness setting. Content observers
 * only: no timer, polling, sensor or extra permission. Observers live as long as the
 * companion process.
 */
final class BrightnessSignals {
    static final String PREFS = "low_light";
    /** Last computed low-light state, the "previous" side of the hysteresis band. */
    static final String STATE = "state";
    /** Last state handed to the face. Written only after a successful send. */
    static final String DELIVERED = "delivered";
    /** State the request logic last acted on; stops repeat requests no face answers. */
    static final String REQUESTED = "requested";
    /** Samsung/AOSP auto-brightness adjustment; present on the tested watch. Trigger only. */
    private static final String AUTO_ADJUST = "screen_auto_brightness_adj";

    private static boolean listening;
    private static int[] range;

    /** One brightness reading for the status screen. */
    static final class Reading {
        final int raw, min, max, percent;
        final boolean lowLight;

        Reading(int raw, int min, int max, int percent, boolean lowLight) {
            this.raw = raw; this.min = min; this.max = max; this.percent = percent; this.lowLight = lowLight;
        }

        String describe() {
            String state = lowLight ? "low light on" : "low light off";
            if (raw < 0) return "Brightness unknown · " + state;
            // The percentage is measured from the range minimum (0 on the tested watch).
            return "Brightness " + raw + "/" + max + " (" + percent + "%) · " + state;
        }
    }

    private BrightnessSignals() { }

    static void listen(Context context) {
        if (listening) return;
        listening = true;
        Context app = context.getApplicationContext();
        ContentObserver observer = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override public void onChange(boolean selfChange) { request(app); }
        };
        for (String name : new String[] {Settings.System.SCREEN_BRIGHTNESS,
                Settings.System.SCREEN_BRIGHTNESS_MODE, AUTO_ADJUST}) {
            app.getContentResolver().registerContentObserver(Settings.System.getUriFor(name), false, observer);
        }
        request(app, true);
    }

    /** Asks the face to reread low light once per state change, and only if it may hold another state. */
    static void request(Context context) { request(context, false); }

    private static synchronized void request(Context context, boolean processStart) {
        boolean current = read(context).lowLight;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean hasRequested = prefs.contains(REQUESTED);
        boolean requested = prefs.getBoolean(REQUESTED, false);
        boolean ask = BrightnessDelivery.shouldRequest(current, prefs.contains(DELIVERED),
                prefs.getBoolean(DELIVERED, false), hasRequested, requested, processStart);
        // Written only when the state changes, never per observer callback.
        if (BrightnessDelivery.shouldStore(current, hasRequested, requested)) prefs.edit().putBoolean(REQUESTED, current).apply();
        if (!ask) return;
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, BrightnessDataSource.class)).requestUpdateAll();
    }

    static float current(Context context) { return read(context).lowLight ? 1f : 0f; }

    /** Reads the setting, applies the hysteresis against the stored state and stores the result. */
    static synchronized Reading read(Context context) {
        int[] bounds = range();
        int raw;
        try {
            raw = Settings.System.getInt(context.getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, BrightnessLevel.UNKNOWN);
        } catch (RuntimeException unreadable) {
            raw = BrightnessLevel.UNKNOWN;
        }
        int percent = BrightnessLevel.percent(raw, bounds[0], bounds[1]);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        boolean previous = prefs.getBoolean(STATE, false);
        boolean low = BrightnessLevel.lowLight(percent, previous);
        if (BrightnessDelivery.shouldStore(low, prefs.contains(STATE), previous)) prefs.edit().putBoolean(STATE, low).apply();
        return new Reading(raw, bounds[0], bounds[1], percent, low);
    }

    /** The device's slider range for the integer setting, or 1..255 when unavailable. */
    private static int[] range() {
        if (range == null) {
            int min = systemInteger("config_screenBrightnessSettingMinimum");
            int max = systemInteger("config_screenBrightnessSettingMaximum");
            range = BrightnessLevel.validRange(min, max) ? new int[] {min, max}
                    : new int[] {BrightnessLevel.FALLBACK_MIN, BrightnessLevel.FALLBACK_MAX};
        }
        return range;
    }

    // These framework values have no public constant; the lookup is read-only and
    // falls back to 1..255 if a device omits or renames them.
    @SuppressLint("DiscouragedApi")
    private static int systemInteger(String name) {
        try {
            Resources system = Resources.getSystem();
            int id = system.getIdentifier(name, "integer", "android");
            return id == 0 ? -1 : system.getInteger(id);
        } catch (RuntimeException missing) {
            return -1;
        }
    }
}
