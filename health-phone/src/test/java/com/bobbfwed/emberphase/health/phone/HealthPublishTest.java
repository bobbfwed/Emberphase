package com.bobbfwed.emberphase.health.phone;

import static org.junit.Assert.*;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import java.time.*;
import org.junit.Test;

public class HealthPublishTest {
    private ActivitySnapshot snapshot(String instant, double minutes, double calories) {
        return ActivitySnapshot.create(Instant.parse(instant), ZoneOffset.UTC,
                new ActivitySnapshot.Metric(minutes, 60.4), new ActivitySnapshot.Metric(calories, 500.2));
    }

    @Test public void displayedWholeNumbersShareAFingerprint() {
        String noon = "2026-11-02T18:00:00Z";
        assertEquals(HealthPublish.fingerprint(snapshot(noon, 42.2, 380.4)),
                HealthPublish.fingerprint(snapshot(noon, 42.4, 380.49)));
        assertNotEquals(HealthPublish.fingerprint(snapshot(noon, 42.2, 380.4)),
                HealthPublish.fingerprint(snapshot(noon, 42.6, 380.4)));
    }

    @Test public void anotherDayPublishes() {
        assertNotEquals(HealthPublish.fingerprint(snapshot("2026-11-02T18:00:00Z", 10, 100)),
                HealthPublish.fingerprint(snapshot("2026-11-03T18:00:00Z", 10, 100)));
    }

    @Test public void unchangedReadingSkipsUntilTheMargin() {
        ActivitySnapshot snapshot = snapshot("2026-11-02T18:00:00Z", 42, 380);
        String fingerprint = HealthPublish.fingerprint(snapshot);
        long expiry = snapshot.expiresAt.toEpochMilli();
        assertFalse(HealthPublish.shouldWrite(false, true, fingerprint, expiry, fingerprint,
                expiry - HealthPublish.MARGIN_MILLIS - 1));
        assertTrue(HealthPublish.shouldWrite(false, true, fingerprint, expiry, fingerprint,
                expiry - HealthPublish.MARGIN_MILLIS));
    }

    @Test public void urgentOrMissingPublicationAlwaysWrites() {
        ActivitySnapshot snapshot = snapshot("2026-11-02T18:00:00Z", 42, 380);
        String fingerprint = HealthPublish.fingerprint(snapshot);
        long expiry = snapshot.expiresAt.toEpochMilli();
        long early = expiry - HealthPublish.MARGIN_MILLIS - 60_000;
        assertTrue(HealthPublish.shouldWrite(true, true, fingerprint, expiry, fingerprint, early));
        assertTrue(HealthPublish.shouldWrite(false, false, fingerprint, expiry, fingerprint, early));
        assertTrue(HealthPublish.shouldWrite(false, true, null, expiry, fingerprint, early));
    }
}
