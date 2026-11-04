package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/** Asks the face to reread power saving. The provider does not poll. */
public final class PowerSaveReceiver extends BroadcastReceiver {
    static void request(Context context) {
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, PowerSaveDataSource.class)).requestUpdateAll();
    }

    @Override public void onReceive(Context context, Intent intent) { request(context); }
}
