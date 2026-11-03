package com.bobbfwed.emberphase.health.watch;

import androidx.wear.watchface.complications.data.ComplicationData;
import androidx.wear.watchface.complications.data.NoDataComplicationData;
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline;
import androidx.wear.watchface.complications.datasource.TimeInterval;
import androidx.wear.watchface.complications.datasource.TimelineEntry;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import java.time.Instant;
import java.time.ZoneId;
import java.util.List;

final class SnapshotTimeline {
    private SnapshotTimeline() { }

    static ComplicationDataTimeline create(ActivitySnapshot snapshot, ComplicationData data,
                                          Instant now, ZoneId zone) {
        // A validity range alone left expired values visible on the Samsung runtime.
        // Give Wear OS an explicit scheduled transition back to unavailable instead.
        if (snapshot == null || !snapshot.isFresh(now, zone) || data instanceof NoDataComplicationData) {
            return new ComplicationDataTimeline(new NoDataComplicationData(), List.of());
        }
        Instant displayMidnight = now.atZone(zone).toLocalDate().plusDays(1).atStartOfDay(zone).toInstant();
        Instant end = displayMidnight.isBefore(snapshot.expiresAt) ? displayMidnight : snapshot.expiresAt;
        // AndroidX requires non-empty timeline entries to match the default type;
        // NO_DATA is the supported exception, so schedule it after the real data.
        return new ComplicationDataTimeline(data, List.of(new TimelineEntry(
                new TimeInterval(end, Instant.ofEpochMilli(Long.MAX_VALUE)), new NoDataComplicationData())));
    }
}
