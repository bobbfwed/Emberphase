package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class PowerSaveDeliveryTest {
    @Test public void missingDeliveryAlwaysRequests() {
        assertTrue(PowerSaveDelivery.shouldRequest(0f, false, 0f));
        assertTrue(PowerSaveDelivery.shouldRequest(1f, false, 1f));
    }

    @Test public void unchangedValueSkipsTheFaceRefresh() {
        assertFalse(PowerSaveDelivery.shouldRequest(0f, true, 0f));
        assertFalse(PowerSaveDelivery.shouldRequest(1f, true, 1f));
    }

    @Test public void changedValueRequests() {
        assertTrue(PowerSaveDelivery.shouldRequest(1f, true, 0f));
        assertTrue(PowerSaveDelivery.shouldRequest(0f, true, 1f));
    }
}
