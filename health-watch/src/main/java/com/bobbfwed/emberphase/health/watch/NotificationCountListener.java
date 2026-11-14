package com.bobbfwed.emberphase.health.watch;

import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;

/** Recounts on every post and removal. Needs notification access; never reads content. */
public final class NotificationCountListener extends NotificationListenerService {
    @Override public void onListenerConnected() { recount(); }
    @Override public void onNotificationPosted(StatusBarNotification sbn) { recount(); }
    @Override public void onNotificationRemoved(StatusBarNotification sbn) { recount(); }

    private void recount() {
        StatusBarNotification[] active;
        try {
            active = getActiveNotifications();
        } catch (SecurityException | IllegalStateException notConnected) {
            return;
        }
        if (active != null) NotificationCount.publish(this, NotificationCount.total(active, getPackageName()));
    }
}
