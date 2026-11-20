package com.bobbfwed.emberphase.health.watch;

import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;

/**
 * Publishes the total notification count. Without notification access it
 * publishes no data, so a face can fall back to its own unread source.
 */
public final class NotificationCountDataSource extends ComplicationDataSourceService {
    private RangedValueComplicationData data(int count) {
        return new RangedValueComplicationData.Builder(count, 0, NotificationCount.MAX,
                new PlainComplicationText.Builder("Notifications").build())
                .setText(new PlainComplicationText.Builder(String.valueOf(count)).build())
                .build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        try {
            if (!NotificationCount.accessGranted(this)) {
                listener.onComplicationData(new NoDataComplicationData());
                return;
            }
            var prefs = getSharedPreferences(NotificationCount.PREFS, MODE_PRIVATE);
            int count = prefs.getInt(NotificationCount.COUNT, 0);
            listener.onComplicationData(data(count));
            prefs.edit().putInt(NotificationCount.DELIVERED, count).apply();
        } catch (android.os.RemoteException disconnected) {
            // Leave the delivered value unchanged so the next change asks again.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(3); }
}
