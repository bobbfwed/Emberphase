package com.bobbfwed.emberphase.health.watch;

/** One short user-requested animation; no recurring task or health payload. */
final class SweepTiming {
    static final long DURATION_MS = 3000;
    static final long DAY_MS = 86_400_000;
    static final float RANGE_MAX = 86_400_001;
    private SweepTiming() { }

    static boolean active(long start, long now) {
        return start > 0 && now >= start && now - start < DURATION_MS;
    }

    // Milliseconds within the UTC day fit in the complication float with <=8 ms
    // quantization. Zero is reserved for idle. WFF handles wrap across midnight.
    static float value(long start) { return (float) (Math.floorMod(start, DAY_MS) + 1); }
}
