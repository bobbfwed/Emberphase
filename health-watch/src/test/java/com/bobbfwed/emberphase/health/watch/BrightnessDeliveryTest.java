package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class BrightnessDeliveryTest {
    private static boolean ask(boolean current, Boolean delivered, Boolean requested) {
        return BrightnessDelivery.shouldRequest(current, delivered != null, delivered != null && delivered,
                requested != null, requested != null && requested, false);
    }

    @Test public void missingDeliveryRequestsOnce() {
        assertTrue(ask(false, null, null));
        assertTrue(ask(true, null, null));
        assertFalse(ask(true, null, true));
    }

    @Test public void stateAlreadyDeliveredSkipsTheFaceRefresh() {
        assertFalse(ask(false, false, null));
        assertFalse(ask(true, true, null));
        assertFalse(ask(true, true, false));
        assertFalse(BrightnessDelivery.shouldRequest(true, true, true, true, false, true));
    }

    @Test public void changedStateRequests() {
        assertTrue(ask(true, false, false));
        assertTrue(ask(false, true, true));
    }

    @Test public void sameUndeliveredStateIsNotRequestedAgain() {
        assertFalse(ask(true, false, true));
        assertFalse(ask(false, true, false));
    }

    @Test public void processStartRequestsOnceWhenDeliveryDiffers() {
        assertTrue(BrightnessDelivery.shouldRequest(true, true, false, true, true, true));
        assertTrue(BrightnessDelivery.shouldRequest(true, false, false, true, true, true));
        assertFalse(BrightnessDelivery.shouldRequest(true, true, true, true, true, true));
    }

    @Test public void storesOnlyMissingOrChangedValues() {
        assertTrue(BrightnessDelivery.shouldStore(true, false, false));
        assertTrue(BrightnessDelivery.shouldStore(false, false, false));
        assertTrue(BrightnessDelivery.shouldStore(true, true, false));
        assertFalse(BrightnessDelivery.shouldStore(true, true, true));
        assertFalse(BrightnessDelivery.shouldStore(false, true, false));
    }

    /** Mirrors BrightnessSignals.request: decide, then store the current state as requested. */
    private static final class Simulation {
        Boolean delivered, requested;
        int requests, writes;

        void signal(boolean current, boolean processStart) {
            if (BrightnessDelivery.shouldRequest(current, delivered != null, delivered != null && delivered,
                    requested != null, requested != null && requested, processStart)) requests++;
            if (BrightnessDelivery.shouldStore(current, requested != null, requested != null && requested)) {
                requested = current;
                writes++;
            }
        }
    }

    @Test public void faceWithoutTheSlotGetsOneRequestPerStateChange() {
        Simulation s = new Simulation();
        s.delivered = false; // Stale: no active slot ever takes delivery.
        s.signal(true, false);
        for (int i = 0; i < 1000; i++) s.signal(true, false); // Auto brightness writes all day.
        assertEquals(1, s.requests);
        assertEquals(1, s.writes);

        s.signal(false, false); // Back to the delivered state: no request needed.
        assertEquals(1, s.requests);
        s.signal(true, false); // Changes again: asked again.
        assertEquals(2, s.requests);
        for (int i = 0; i < 1000; i++) s.signal(true, false);
        assertEquals(2, s.requests);
        assertEquals(3, s.writes);
    }

    @Test public void processStartRetriesAMissedDeliveryOnce() {
        Simulation s = new Simulation();
        s.delivered = false;
        s.requested = true; // Requested before the process died; never delivered.
        s.signal(true, true);
        assertEquals(1, s.requests);
        s.signal(true, false);
        assertEquals(1, s.requests);
        s.delivered = true; // The face's periodic or activation request delivered it.
        s.signal(true, true);
        assertEquals(1, s.requests);
        assertEquals(0, s.writes);
    }
}
