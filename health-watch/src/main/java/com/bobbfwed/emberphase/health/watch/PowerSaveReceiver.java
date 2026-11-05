package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/** Asks the face to reread power saving when the value changed. The provider does not poll. */
public final class PowerSaveReceiver extends BroadcastReceiver {
    static final String PREFS = "power_save";
    static final String DELIVERED = "delivered";

    static void request(Context context) {
        float current = PowerSaveSignals.current(context);
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!PowerSaveDelivery.shouldRequest(current, prefs.contains(DELIVERED), prefs.getFloat(DELIVERED, 0f))) return;
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, PowerSaveDataSource.class)).requestUpdateAll();
    }

    @Override public void onReceive(Context context, Intent intent) { request(context); }
}
