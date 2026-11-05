package com.bobbfwed.emberphase.health.watch;

import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;

/** Publishes 1 while system power saving is on, otherwise 0. No polling. */
public final class PowerSaveDataSource extends ComplicationDataSourceService {
    private RangedValueComplicationData data(float value) {
        return new RangedValueComplicationData.Builder(value, 0, 1,
                new PlainComplicationText.Builder("Power saving").build())
                .setText(new PlainComplicationText.Builder(value > 0 ? "On" : "Off").build())
                .build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        float value = PowerSaveSignals.current(this);
        try {
            listener.onComplicationData(data(value));
            getSharedPreferences(PowerSaveReceiver.PREFS, MODE_PRIVATE).edit()
                    .putFloat(PowerSaveReceiver.DELIVERED, value).apply();
        } catch (android.os.RemoteException disconnected) {
            // Leave the stored value unchanged so the next signal asks again.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(0); }
}
