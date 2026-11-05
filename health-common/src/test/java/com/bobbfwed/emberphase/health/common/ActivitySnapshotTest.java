package com.bobbfwed.emberphase.health.common;

import static org.junit.Assert.*;
import java.time.*;
import org.junit.Test;

public class ActivitySnapshotTest {
    private final ActivitySnapshot.Metric minutes = new ActivitySnapshot.Metric(42.0, 60.0);
    private final ActivitySnapshot.Metric calories = new ActivitySnapshot.Metric(380.0, 500.0);

    @Test public void expiryStopsAtLocalMidnightAcrossDst() {
        ZoneId zone = ZoneId.of("America/Los_Angeles");
        Instant now = ZonedDateTime.of(2026, 11, 1, 23, 30, 0, 0, zone).toInstant();
        ActivitySnapshot snapshot = ActivitySnapshot.create(now, zone, minutes, calories);
        assertEquals(Instant.parse("2026-11-02T08:00:00Z"), snapshot.expiresAt);
        assertTrue(snapshot.isFresh(now.plusSeconds(60), zone));
        assertFalse(snapshot.isFresh(snapshot.expiresAt, zone));
    }

    @Test public void staleOrFutureSnapshotsAreUnavailable() {
        Instant now = Instant.parse("2026-11-02T18:00:00Z");
        ActivitySnapshot snapshot = ActivitySnapshot.create(now, ZoneOffset.UTC, minutes, calories);
        assertTrue(snapshot.isFresh(now.plusSeconds(7200), ZoneOffset.UTC));
        assertFalse(snapshot.isFresh(now.plusSeconds(10800), ZoneOffset.UTC));
        assertFalse(snapshot.isFresh(now.minusSeconds(301), ZoneOffset.UTC));
    }

    @Test public void travelCannotDisplayAnotherLocalDaysTotals() {
        Instant now = Instant.parse("2026-11-02T07:30:00Z");
        ActivitySnapshot snapshot = ActivitySnapshot.create(now, ZoneId.of("America/Los_Angeles"), minutes, calories);
        assertFalse(snapshot.isFresh(now, ZoneId.of("Asia/Tokyo")));
    }

    @Test public void zeroAndMissingAreDistinctAndOverGoalValuesSurvive() {
        ActivitySnapshot.Metric empty = new ActivitySnapshot.Metric(null, null);
        ActivitySnapshot.Metric zero = new ActivitySnapshot.Metric(0.0, 60.0);
        ActivitySnapshot.Metric over = new ActivitySnapshot.Metric(90.0, 60.0);
        assertFalse(empty.hasProgress());
        assertTrue(zero.hasProgress());
        assertEquals(90.0, over.value, 0.0);
    }

    @Test public void invalidNumbersAreRejected() {
        assertThrows(IllegalArgumentException.class, () -> new ActivitySnapshot.Metric(Double.NaN, 60.0));
        assertThrows(IllegalArgumentException.class, () -> new ActivitySnapshot.Metric(-1.0, 60.0));
        assertThrows(IllegalArgumentException.class, () -> new ActivitySnapshot.Metric(1.0, 0.0));
        assertThrows(IllegalArgumentException.class, () -> new ActivitySnapshot.Metric(1.0, Double.POSITIVE_INFINITY));
    }
}
