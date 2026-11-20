package com.bobbfwed.emberphase.health.watch;

/**
 * Decides when to ask the face to reread the low-light state.
 *
 * "Delivered" is the state the face last received. "Requested" is the state the
 * request logic last acted on; after every decision the caller stores the current
 * state there (it changes only when the state changes). Without it, a face that has
 * no low-light slot never takes delivery, and every brightness write would broadcast
 * another update request for as long as the state differs from the stale delivery.
 */
final class BrightnessDelivery {
    private BrightnessDelivery() { }

    /**
     * @param processStart true for the single check when the companion process starts;
     *                     it asks once more if the face may still hold an old state.
     */
    static boolean shouldRequest(boolean current, boolean hasDelivered, boolean delivered,
            boolean hasRequested, boolean requested, boolean processStart) {
        if (hasDelivered && current == delivered) return false;
        if (processStart) return true;
        return !hasRequested || current != requested;
    }

    /** Preference writes happen only when a stored state is missing or changes, never per callback. */
    static boolean shouldStore(boolean value, boolean hasStored, boolean stored) {
        return !hasStored || stored != value;
    }
}
