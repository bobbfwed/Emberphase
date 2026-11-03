package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class SweepTimingTest {
    @Test public void repeatsAndLateRequestsCannotRestartSession() {
        long start = 1_793_700_000_000L;
        assertFalse(SweepTiming.active(0, start));
        assertFalse(SweepTiming.active(start, start - 1));
        assertTrue(SweepTiming.active(start, start));
        assertTrue(SweepTiming.active(start, start + 2999));
        assertFalse(SweepTiming.active(start, start + 3000));
        assertFalse(SweepTiming.active(start, start + SweepTiming.DAY_MS));
    }

    @Test public void floatTimestampIsPreciseEnoughAcrossUtcMidnight() {
        for (long offset = 0; offset < SweepTiming.DAY_MS; offset += 997) {
            float encoded = SweepTiming.value(SweepTiming.DAY_MS * 20000 + offset);
            assertTrue(encoded > 0 && encoded <= SweepTiming.RANGE_MAX);
            assertTrue(Math.abs((double) encoded - 1 - offset) <= 4);
        }
        long start = SweepTiming.DAY_MS * 20000 - 1000;
        long after = start + 2000;
        double elapsed = (after % SweepTiming.DAY_MS - (SweepTiming.value(start) - 1.0)
                + SweepTiming.DAY_MS) % SweepTiming.DAY_MS;
        assertEquals(2000, elapsed, 4);
    }
}
