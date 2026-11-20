package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import android.app.Notification;
import org.junit.Test;

public class NotificationCountTest {
    @Test public void countsOrdinaryNotifications() {
        assertTrue(NotificationCount.counts(0, true, false));
        assertTrue(NotificationCount.counts(Notification.FLAG_AUTO_CANCEL, true, false));
    }

    @Test public void skipsWhatNobodyDismisses() {
        assertFalse(NotificationCount.counts(0, false, false));
        assertFalse(NotificationCount.counts(Notification.FLAG_ONGOING_EVENT, true, false));
        assertFalse(NotificationCount.counts(Notification.FLAG_FOREGROUND_SERVICE, true, false));
        assertFalse(NotificationCount.counts(Notification.FLAG_GROUP_SUMMARY, true, false));
        assertFalse(NotificationCount.counts(0, true, true));
    }
}
