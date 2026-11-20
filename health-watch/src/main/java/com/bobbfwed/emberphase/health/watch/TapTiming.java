package com.bobbfwed.emberphase.health.watch;

/** A short user-requested animation window; no recurring task or health payload. */
final class TapTiming {
    static final long DAY_MS = 86_400_000;
    static final float RANGE_MAX = 86_400_001;
    /** Mechanical face: six-second center-hub sweep. */
    static final TapTiming SWEEP = new TapTiming(6000);
    /** Meniscus: 3.2 seconds of slosh plus a short margin. */
    static final TapTiming CORE_TAP = new TapTiming(3500);

    final long durationMs;

    TapTiming(long durationMs) { this.durationMs = durationMs; }

    boolean active(long start, long now) {
        return start > 0 && now >= start && now - start < durationMs;
    }

    // The wire timeline can outlive the visible motion by less than a second.
    // Keep publishing the same timestamp through that grace period so a provider
    // refresh cannot replace it with idle while the motion is still running.
    boolean publishing(long start, long now) {
        return start > 0 && now >= start && now < timelineEnd(start);
    }

    // Milliseconds within the UTC day fit in the complication float with <=8 ms
    // quantization. Zero is reserved for idle. WFF handles wrap across midnight.
    static float value(long start) { return (float) (Math.floorMod(start, DAY_MS) + 1); }

    long timelineEnd(long start) {
        // AndroidX serializes timeline bounds as epoch SECONDS. Rounding down
        // truncates the last 0-999 ms of motion, so retain the signal until the
        // next whole second.
        long end = start + durationMs;
        return Math.floorDiv(end + 999, 1000) * 1000;
    }
}
