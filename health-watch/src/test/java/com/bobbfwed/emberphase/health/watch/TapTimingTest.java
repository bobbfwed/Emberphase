package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class TapTimingTest {
    private static final TapTiming[] ALL = { TapTiming.SWEEP, TapTiming.CORE_TAP };

    @Test public void durations() {
        assertEquals(6000, TapTiming.SWEEP.durationMs);
        // The face's slosh runs 3.2 s; the window must cover it.
        assertTrue(TapTiming.CORE_TAP.durationMs >= 3200);
        assertTrue(TapTiming.CORE_TAP.durationMs < 5000);
    }

    @Test public void repeatsAndLateRequestsCannotRestartSession() {
        long start = 1_793_700_000_000L;
        for (TapTiming t : ALL) {
            long d = t.durationMs;
            assertFalse(t.active(0, start));
            assertFalse(t.active(start, start - 1));
            assertTrue(t.active(start, start));
            assertTrue(t.active(start, start + d - 1));
            assertFalse(t.active(start, start + d));
            assertFalse(t.active(start, start + TapTiming.DAY_MS));
        }
    }

    @Test public void wireTimelineNeverCutsOffMotionAtAnyTapMillisecond() {
        long base = 1_793_700_000_000L;
        for (TapTiming t : ALL) {
            for (int ms = 0; ms < 1000; ms++) {
                long start = base + ms;
                long wireEnd = Math.floorDiv(t.timelineEnd(start), 1000) * 1000;
                assertTrue(wireEnd >= start + t.durationMs);
                assertTrue(wireEnd < start + t.durationMs + 1000);
                assertEquals(0, t.timelineEnd(start) % 1000);
            }
        }
    }

    @Test public void refreshDuringWholeSecondGraceKeepsTheSameTimestamp() {
        long start = 1_793_700_000_100L;
        for (TapTiming t : ALL) {
            assertFalse(t.active(start, start + t.durationMs));
            assertTrue(t.publishing(start, start + t.durationMs));
            assertTrue(t.publishing(start, t.timelineEnd(start) - 1));
            assertFalse(t.publishing(start, t.timelineEnd(start)));
            assertFalse(t.publishing(0, start));
            assertFalse(t.publishing(start, start - 1));
        }
    }

    @Test public void floatTimestampIsPreciseEnoughAcrossUtcMidnight() {
        for (long offset = 0; offset < TapTiming.DAY_MS; offset += 997) {
            float encoded = TapTiming.value(TapTiming.DAY_MS * 20000 + offset);
            assertTrue(encoded > 0 && encoded <= TapTiming.RANGE_MAX);
            assertTrue(Math.abs((double) encoded - 1 - offset) <= 4);
        }
        long start = TapTiming.DAY_MS * 20000 - 1000;
        long after = start + 2000;
        double elapsed = (after % TapTiming.DAY_MS - (TapTiming.value(start) - 1.0)
                + TapTiming.DAY_MS) % TapTiming.DAY_MS;
        assertEquals(2000, elapsed, 4);
    }
}
