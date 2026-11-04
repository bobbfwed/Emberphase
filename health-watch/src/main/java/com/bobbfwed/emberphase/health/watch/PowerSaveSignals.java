package com.bobbfwed.emberphase.health.watch;

import android.content.Context;
import android.content.IntentFilter;
import android.database.ContentObserver;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;

/** Event-driven power-saving signal. No timer and no polling. */
final class PowerSaveSignals {
    private static boolean listening;

    private PowerSaveSignals() { }

    static void listen(Context context) {
        if (listening) return;
        listening = true;
        Context app = context.getApplicationContext();
        app.registerReceiver(new PowerSaveReceiver(),
                new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED), Context.RECEIVER_NOT_EXPORTED);
        ContentObserver observer = new ContentObserver(new Handler(Looper.getMainLooper())) {
            @Override public void onChange(boolean selfChange) { PowerSaveReceiver.request(app); }
        };
        app.getContentResolver().registerContentObserver(
                Settings.Global.getUriFor("low_power"), false, observer);
        for (String name : new String[] {"ultra_powersaving_mode", "minimal_battery_use", "psm_switch"}) {
            app.getContentResolver().registerContentObserver(Settings.System.getUriFor(name), false, observer);
            app.getContentResolver().registerContentObserver(Settings.Global.getUriFor(name), false, observer);
        }
        PowerSaveReceiver.request(app);
    }

    static float current(Context context) {
        PowerManager power = context.getSystemService(PowerManager.class);
        if (power != null && power.isPowerSaveMode()) return 1f;
        if (flag(context, "low_power", true)) return 1f;
        for (String name : new String[] {"ultra_powersaving_mode", "minimal_battery_use", "psm_switch"}) {
            if (flag(context, name, true) || flag(context, name, false)) return 1f;
        }
        return 0f;
    }

    private static boolean flag(Context context, String name, boolean global) {
        try {
            return (global ? Settings.Global.getInt(context.getContentResolver(), name, 0)
                    : Settings.System.getInt(context.getContentResolver(), name, 0)) == 1;
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
