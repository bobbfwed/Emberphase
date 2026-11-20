package com.bobbfwed.emberphase.health.watch;

/** Turns the raw screen-brightness setting into the low-light state. No Android types. */
final class BrightnessLevel {
    /** Low light turns on at or below this percentage of the device's brightness range. */
    static final int LOW_LIGHT_ON_PERCENT = 15;
    /** Low light turns off at or above this percentage. Values in between keep the previous state. */
    static final int LOW_LIGHT_OFF_PERCENT = 20;
    /** Used when the device does not publish a usable brightness range. */
    static final int FALLBACK_MIN = 1;
    static final int FALLBACK_MAX = 255;
    /** A raw value or percentage that could not be read. */
    static final int UNKNOWN = -1;

    private BrightnessLevel() { }

    /** True when the device range can be used; otherwise callers fall back to 1..255. */
    static boolean validRange(int min, int max) {
        return min >= 0 && max > min;
    }

    /**
     * The raw value as a whole percentage of the device range, rounded to the nearest
     * percent and clamped to 0..100. Rounding keeps the logic equal to the percentage
     * the companion's status screen shows. A negative raw value means unknown.
     */
    static int percent(int raw, int min, int max) {
        if (raw < 0) return UNKNOWN;
        if (!validRange(min, max)) {
            min = FALLBACK_MIN;
            max = FALLBACK_MAX;
        }
        int clamped = Math.max(min, Math.min(max, raw));
        return (int) Math.round(100.0 * (clamped - min) / (max - min));
    }

    /** Applies the hysteresis band. An unknown percentage always means not low light. */
    static boolean lowLight(int percent, boolean previous) {
        if (percent < 0) return false;
        if (percent <= LOW_LIGHT_ON_PERCENT) return true;
        if (percent >= LOW_LIGHT_OFF_PERCENT) return false;
        return previous;
    }
}
