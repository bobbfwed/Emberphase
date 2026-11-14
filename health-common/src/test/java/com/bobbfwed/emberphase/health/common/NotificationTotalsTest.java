package com.bobbfwed.emberphase.health.common;

import static org.junit.Assert.*;
import android.app.Notification;
import org.junit.Test;

public class NotificationTotalsTest {
    @Test public void countsOrdinaryNotifications() {
        assertTrue(NotificationTotals.counts(0, true, false));
        assertTrue(NotificationTotals.counts(Notification.FLAG_AUTO_CANCEL, true, false));
    }

    @Test public void skipsWhatNobodyDismisses() {
        assertFalse(NotificationTotals.counts(0, false, false));
        assertFalse(NotificationTotals.counts(Notification.FLAG_ONGOING_EVENT, true, false));
        assertFalse(NotificationTotals.counts(Notification.FLAG_FOREGROUND_SERVICE, true, false));
        assertFalse(NotificationTotals.counts(Notification.FLAG_GROUP_SUMMARY, true, false));
        assertFalse(NotificationTotals.counts(0, true, true));
    }

    @Test public void capsTheTotal() {
        assertEquals(0, NotificationTotals.cap(-2));
        assertEquals(7, NotificationTotals.cap(7));
        assertEquals(NotificationTotals.MAX, NotificationTotals.cap(250));
    }
}
