package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.ComplicationDataTimeline;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import java.time.*;
import org.junit.Test;

public class SnapshotTimelineTest {
    private final ZoneId zone = ZoneId.of("America/Los_Angeles");
    private final Instant captured = Instant.parse("2026-11-03T07:55:00Z");
    private final ActivitySnapshot snapshot = ActivitySnapshot.create(captured, zone,
            new ActivitySnapshot.Metric(51.0, 90.0), new ActivitySnapshot.Metric(421.0, 500.0));

    private ComplicationData data() {
        return new GoalProgressComplicationData.Builder(51, 90,
                new PlainComplicationText.Builder("Active minutes").build())
                .setText(new PlainComplicationText.Builder("51").build()).build();
    }

    @Test public void midnightHasExplicitUnavailableFallbackWithoutAnotherSync() {
        ComplicationDataTimeline timeline = SnapshotTimeline.create(snapshot, data(), captured, zone);
        timeline.validate$watchface_complications_data_source();
        assertTrue(timeline.getDefaultComplicationData() instanceof GoalProgressComplicationData);
        assertEquals(1, timeline.getTimelineEntries().size());
        var entry = timeline.getTimelineEntries().iterator().next();
        assertEquals(Instant.parse("2026-11-03T08:00:00Z"), entry.getValidity().getStart());
        assertTrue(entry.getComplicationData() instanceof NoDataComplicationData);
        assertEquals(51f, ((GoalProgressComplicationData) timeline.getDefaultComplicationData()).getValue(), 0);
    }

    @Test public void yesterdayCannotBeReissuedAfterMidnight() {
        var timeline = SnapshotTimeline.create(snapshot, data(), snapshot.expiresAt, zone);
        assertTrue(timeline.getTimelineEntries().isEmpty());
        assertTrue(timeline.getDefaultComplicationData() instanceof NoDataComplicationData);
    }

    @Test public void daytimeDisconnectExpiresAfterTwoHours() {
        Instant noon = Instant.parse("2026-11-03T20:00:00Z");
        var daytime = ActivitySnapshot.create(noon, zone, snapshot.minutes, snapshot.calories);
        var timeline = SnapshotTimeline.create(daytime, data(), noon, zone);
        assertEquals(noon.plusSeconds(7200), timeline.getTimelineEntries().iterator().next().getValidity().getStart());
    }

    @Test public void changedDisplayDateRejectsSnapshot() {
        var timeline = SnapshotTimeline.create(snapshot, data(), captured, ZoneId.of("Asia/Tokyo"));
        assertTrue(timeline.getTimelineEntries().isEmpty());
    }

    @Test public void earlierWatchMidnightEndsTheTimeline() {
        Instant evening = Instant.parse("2026-11-03T04:00:00Z");
        var sameDay = ActivitySnapshot.create(evening, zone, snapshot.minutes, snapshot.calories);
        var timeline = SnapshotTimeline.create(sameDay, data(), evening, ZoneId.of("America/New_York"));
        assertEquals(Instant.parse("2026-11-03T05:00:00Z"),
                timeline.getTimelineEntries().iterator().next().getValidity().getStart());
    }
}
