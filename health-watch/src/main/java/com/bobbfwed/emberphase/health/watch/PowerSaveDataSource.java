package com.bobbfwed.emberphase.health.watch;

import android.content.Context;
import android.content.IntentFilter;
import android.os.PowerManager;
import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;

/** Publishes 1 while system power saving is on, otherwise 0. No polling. */
public final class PowerSaveDataSource extends ComplicationDataSourceService {
    private PowerSaveReceiver updates;

    private RangedValueComplicationData data(float value) {
        return new RangedValueComplicationData.Builder(value, 0, 1,
                new PlainComplicationText.Builder("Power saving").build())
                .setText(new PlainComplicationText.Builder(value > 0 ? "On" : "Off").build())
                .build();
    }

    private float current() {
        PowerManager power = getSystemService(PowerManager.class);
        return power != null && power.isPowerSaveMode() ? 1f : 0f;
    }

    @Override public void onCreate() {
        super.onCreate();
        updates = new PowerSaveReceiver();
        registerReceiver(updates, new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED), Context.RECEIVER_NOT_EXPORTED);
    }

    @Override public void onDestroy() {
        if (updates != null) unregisterReceiver(updates);
        super.onDestroy();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        try {
            listener.onComplicationData(data(current()));
        } catch (android.os.RemoteException disconnected) {
            // The next request reads power saving again. Nothing is scheduled.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(0); }
}
