package com.bobbfwed.emberphase.health.watch;

import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;
import com.bobbfwed.emberphase.health.common.NotificationTotals;

/**
 * Publishes the total notification count (watch plus phone). With neither
 * side able to count it publishes no data, so a face can fall back to its own unread source.
 */
public final class NotificationCountDataSource extends ComplicationDataSourceService {
    private RangedValueComplicationData data(int count) {
        return new RangedValueComplicationData.Builder(count, 0, NotificationTotals.MAX,
                new PlainComplicationText.Builder("Notifications").build())
                .setText(new PlainComplicationText.Builder(String.valueOf(count)).build())
                .build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        try {
            var prefs = NotificationCount.prefs(this);
            if (!NotificationCount.available(this)) {
                listener.onComplicationData(new NoDataComplicationData());
                prefs.edit().remove(NotificationCount.DELIVERED).apply();
                return;
            }
            int count = NotificationCount.total(prefs);
            listener.onComplicationData(data(count));
            prefs.edit().putInt(NotificationCount.DELIVERED, count).apply();
        } catch (android.os.RemoteException disconnected) {
            // Leave the delivered value unchanged so the next change asks again.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(3); }
}
