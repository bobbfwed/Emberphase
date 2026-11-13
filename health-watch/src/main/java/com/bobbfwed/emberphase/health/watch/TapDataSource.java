package com.bobbfwed.emberphase.health.watch;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Intent;
import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;
import java.time.Instant;
import java.util.List;

/** Tap control shared by the face-specific providers. Publishes one timestamp, not frames. */
abstract class TapDataSource extends ComplicationDataSourceService {
    abstract TapTiming timing();
    abstract String prefsName();
    abstract Class<? extends BroadcastReceiver> receiver();
    abstract int requestCode();
    abstract String description();

    private RangedValueComplicationData data(float value) {
        PendingIntent tap = PendingIntent.getBroadcast(this, requestCode(), new Intent(this, receiver()),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RangedValueComplicationData.Builder(value, 0, TapTiming.RANGE_MAX,
                new PlainComplicationText.Builder(description()).build())
                .setText(new PlainComplicationText.Builder("Tap").build()).setTapAction(tap).build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        long start = getSharedPreferences(prefsName(), MODE_PRIVATE).getLong("start", 0);
        long now = System.currentTimeMillis();
        try {
            var idle = data(0);
            if (timing().publishing(start, now)) {
                // The platform returns to idle without an alarm, timer, or another
                // process wakeup. A late request never replays an expired session.
                listener.onComplicationDataTimeline(new ComplicationDataTimeline(idle, List.of(
                        new TimelineEntry(new TimeInterval(Instant.ofEpochMilli(start),
                                Instant.ofEpochMilli(timing().timelineEnd(start))), data(TapTiming.value(start))))));
            } else {
                listener.onComplicationData(idle);
            }
        } catch (android.os.RemoteException disconnected) {
            // The timestamp cannot replay an expired session.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(0); }
}
