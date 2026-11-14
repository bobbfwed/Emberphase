package com.bobbfwed.emberphase.health.watch;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.service.notification.StatusBarNotification;
import com.bobbfwed.emberphase.health.common.NotificationTotals;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;

/**
 * Total notifications for the face: the watch's own plus the phone's count.
 * Samsung reports UNREAD_NOTIFICATION_COUNT only as 0 or 1, and phone
 * notifications live in Wear OS's private stream, so the phone companion
 * counts its own and sends the number over the Data Layer.
 */
final class NotificationCount {
    static final String PREFS = "notification_count";
    static final String LOCAL = "local";
    static final String PHONE = "phone";
    static final String DELIVERED = "delivered";

    private NotificationCount() { }

    static int local(StatusBarNotification[] active, String ownPackage) {
        int total = 0;
        for (StatusBarNotification sbn : active) {
            if (NotificationTotals.counts(sbn.getNotification().flags, sbn.isClearable(),
                    ownPackage.equals(sbn.getPackageName()))) total++;
        }
        return total;
    }

    static boolean accessGranted(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager != null && manager.isNotificationListenerAccessGranted(
                new ComponentName(context, NotificationCountListener.class));
    }

    static SharedPreferences prefs(Context context) { return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    /** Data exists once either side can count. */
    static boolean available(Context context) { return accessGranted(context) || prefs(context).contains(PHONE); }

    static int total(SharedPreferences prefs) {
        return NotificationTotals.cap(prefs.getInt(LOCAL, 0) + prefs.getInt(PHONE, 0));
    }

    static void setLocal(Context context, int count) {
        prefs(context).edit().putInt(LOCAL, count).apply();
        requestIfChanged(context);
    }

    /** null clears the phone's count (access revoked or sharing stopped). */
    static void setPhone(Context context, Integer count) {
        SharedPreferences.Editor edit = prefs(context).edit();
        if (count == null) edit.remove(PHONE); else edit.putInt(PHONE, count);
        edit.apply();
        requestIfChanged(context);
    }

    private static void requestIfChanged(Context context) {
        SharedPreferences prefs = prefs(context);
        boolean available = available(context);
        boolean delivered = prefs.contains(DELIVERED);
        if (available == delivered && (!available || prefs.getInt(DELIVERED, -1) == total(prefs))) return;
        ComplicationDataSourceUpdateRequester.create(context,
                new ComponentName(context, NotificationCountDataSource.class)).requestUpdateAll();
    }
}
