package com.bobbfwed.emberphase.health.watch;

/** Skips a face refresh when the delivered power-saving value has not changed. */
final class PowerSaveDelivery {
    private PowerSaveDelivery() { }

    static boolean shouldRequest(float current, boolean hasDelivered, float delivered) {
        return !hasDelivered || Float.compare(current, delivered) != 0;
    }
}
