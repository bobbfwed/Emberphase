package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.BatteryManager;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

public final class SweepReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        BatteryManager battery = context.getSystemService(BatteryManager.class);
        if (battery == null || battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY) <= 15) return;
        var prefs = context.getSharedPreferences("mechanical_sweep", Context.MODE_PRIVATE);
        long now = System.currentTimeMillis();
        if (SweepTiming.active(prefs.getLong("start", 0), now)) return;
        prefs.edit().putLong("start", now).apply();
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, SweepDataSource.class)).requestUpdateAll();
    }
}
