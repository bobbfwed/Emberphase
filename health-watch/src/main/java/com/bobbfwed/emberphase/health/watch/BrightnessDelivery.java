package com.bobbfwed.emberphase.health.watch;

/** Skips a face refresh when the delivered low-light state has not changed. */
final class BrightnessDelivery {
    private BrightnessDelivery() { }

    static boolean shouldRequest(boolean current, boolean hasDelivered, boolean delivered) {
        return !hasDelivered || current != delivered;
    }
}
