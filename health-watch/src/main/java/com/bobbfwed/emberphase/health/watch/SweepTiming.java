package com.bobbfwed.emberphase.health.watch;

/** One short user-requested animation; no recurring task or health payload. */
final class SweepTiming {
    static final long DURATION_MS = 6000;
    static final long DAY_MS = 86_400_000;
    static final float RANGE_MAX = 86_400_001;
    private SweepTiming() { }

    static boolean active(long start, long now) {
        return start > 0 && now >= start && now - start < DURATION_MS;
    }

    // The wire timeline can outlive the visible motion by less than a second.
    // Keep publishing the same timestamp through that grace period so a provider
    // refresh cannot replace it with idle while the hands are still arriving.
    static boolean publishing(long start, long now) {
        return start > 0 && now >= start && now < timelineEnd(start);
    }

    // Milliseconds within the UTC day fit in the complication float with <=8 ms
    // quantization. Zero is reserved for idle. WFF handles wrap across midnight.
    static float value(long start) { return (float) (Math.floorMod(start, DAY_MS) + 1); }

    static long timelineEnd(long start) {
        // AndroidX serializes timeline bounds as epoch SECONDS. Rounding down
        // truncates the last 0–999 ms of motion, so retain the signal until the
        // next whole second. WFF clamps at 6 s and shows native hands thereafter.
        long end = start + DURATION_MS;
        return Math.floorDiv(end + 999, 1000) * 1000;
    }
}
