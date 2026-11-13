package com.bobbfwed.emberphase.health.watch;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.*;
import java.time.Instant;
import java.util.List;

/** Face tap control. Publishes one timestamp, not animation frames. */
public final class SweepDataSource extends ComplicationDataSourceService {
    private RangedValueComplicationData data(float value) {
        PendingIntent tap = PendingIntent.getBroadcast(this, 1, new Intent(this, SweepReceiver.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RangedValueComplicationData.Builder(value, 0, SweepTiming.RANGE_MAX,
                new PlainComplicationText.Builder("Run face animation").build())
                .setText(new PlainComplicationText.Builder("Tap").build()).setTapAction(tap).build();
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        long start = getSharedPreferences("mechanical_sweep", MODE_PRIVATE).getLong("start", 0);
        long now = System.currentTimeMillis();
        try {
            var idle = data(0);
            if (SweepTiming.publishing(start, now)) {
                // The platform returns to idle without an alarm, timer, or another
                // process wakeup. A late request never replays an expired session.
                listener.onComplicationDataTimeline(new ComplicationDataTimeline(idle, List.of(
                        new TimelineEntry(new TimeInterval(Instant.ofEpochMilli(start),
                                Instant.ofEpochMilli(SweepTiming.timelineEnd(start))), data(SweepTiming.value(start))))));
            } else {
                listener.onComplicationData(idle);
            }
        } catch (android.os.RemoteException disconnected) {
            // The timestamp cannot replay an expired six-second session.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) { return data(0); }
}
