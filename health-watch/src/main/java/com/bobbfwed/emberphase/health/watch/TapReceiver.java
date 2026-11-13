package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.BatteryManager;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/** Records a tap time and asks the matching provider to publish it once. */
abstract class TapReceiver extends BroadcastReceiver {
    abstract TapTiming timing();
    abstract String prefsName();
    abstract Class<? extends TapDataSource> source();

    @Override public void onReceive(Context context, Intent intent) {
        BatteryManager battery = context.getSystemService(BatteryManager.class);
        if (battery == null || battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) <= 15) return;
        var prefs = context.getSharedPreferences(prefsName(), Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (timing().active(prefs.getLong("start", 0), now)) return;
        prefs.edit().putLong("start", now).apply();
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, source())).requestUpdateAll();
    }
}
