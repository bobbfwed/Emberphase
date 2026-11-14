package com.bobbfwed.emberphase.health.watch;

import android.app.Notification;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.service.notification.StatusBarNotification;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/**
 * Total notifications on the watch. Samsung reports UNREAD_NOTIFICATION_COUNT
 * as 0 or 1, and Wear OS marks everything read once the list is opened, so a
 * face that wants the real number gets it from here.
 */
final class NotificationCount {
    static final String PREFS = "notification_count";
    static final String COUNT = "count";
    static final String DELIVERED = "delivered";
    static final int MAX = 99;
    private static final int NOT_COUNTED = Notification.FLAG_ONGOING_EVENT
            | Notification.FLAG_FOREGROUND_SERVICE | Notification.FLAG_GROUP_SUMMARY;

    private NotificationCount() { }

    /** Counts what a person would dismiss: not ongoing, not a group header, not ours. */
    static boolean counts(int flags, boolean clearable, boolean own) {
        return clearable && !own && (flags & NOT_COUNTED) == 0;
    }

    static int total(StatusBarNotification[] active, String ownPackage) {
        int total = 0;
        for (StatusBarNotification sbn : active) {
            if (counts(sbn.getNotification().flags, sbn.isClearable(), ownPackage.equals(sbn.getPackageName()))) total++;
        }
        return Math.min(total, MAX);
    }

    static boolean accessGranted(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager != null && manager.isNotificationListenerAccessGranted(
                new ComponentName(context, NotificationCountListener.class));
    }

    /** Stores the count and asks the face to reread it only when it changed. */
    static void publish(Context context, int count) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        prefs.edit().putInt(COUNT, count).apply();
        if (prefs.contains(DELIVERED) && prefs.getInt(DELIVERED, -1) == count) return;
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, NotificationCountDataSource.class)).requestUpdateAll();
    }
}
