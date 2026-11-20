package com.bobbfwed.emberphase.health.watch;

import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;

/**
 * Publishes 1 while the screen brightness is low (see BrightnessLevel), otherwise 0.
 * Pushed on change; the manifest's 600-second period is only a slow fallback.
 */
public final class BrightnessDataSource extends ComplicationDataSourceService {
    private RangedValueComplicationData data(float value) {
        return new RangedValueComplicationData.Builder(value, 0, 1,
                new PlainComplicationText.Builder("Low light").build())
                .setText(new PlainComplicationText.Builder(value > 0 ? "On" : "Off").build())
                .build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        float value = BrightnessSignals.current(this);
        try {
            listener.onComplicationData(data(value));
            getSharedPreferences(BrightnessSignals.PREFS, MODE_PRIVATE).edit()
                    .putBoolean(BrightnessSignals.DELIVERED, value > 0).apply();
        } catch (android.os.RemoteException disconnected) {
            // Leave the stored value unchanged so the next signal asks again.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(0); }
}
