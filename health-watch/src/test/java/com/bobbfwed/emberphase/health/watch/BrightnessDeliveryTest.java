package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class BrightnessDeliveryTest {
    @Test public void missingDeliveryAlwaysRequests() {
        assertTrue(BrightnessDelivery.shouldRequest(false, false, false));
        assertTrue(BrightnessDelivery.shouldRequest(true, false, true));
    }

    @Test public void unchangedStateSkipsTheFaceRefresh() {
        assertFalse(BrightnessDelivery.shouldRequest(false, true, false));
        assertFalse(BrightnessDelivery.shouldRequest(true, true, true));
    }

    @Test public void changedStateRequests() {
        assertTrue(BrightnessDelivery.shouldRequest(true, true, false));
        assertTrue(BrightnessDelivery.shouldRequest(false, true, true));
    }
}
