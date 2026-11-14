package com.bobbfwed.emberphase.health.phone;

import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import com.bobbfwed.emberphase.health.common.NotificationTotals;
import com.google.android.gms.wearable.PutDataMapRequest;
import com.google.android.gms.wearable.PutDataRequest;
import com.google.android.gms.wearable.Wearable;

/**
 * Counts the phone's notifications and sends the number (never any content)
 * to the watch, only when it changes. Needs notification access.
 */
public final class PhoneNotificationCounter extends NotificationListenerService {
    static final String PREFS = "notification_count";
    static final String SENT = "sent";

    @Override public void onListenerConnected() { recount(); }
    @Override public void onNotificationPosted(StatusBarNotification sbn) { recount(); }
    @Override public void onNotificationRemoved(StatusBarNotification sbn) { recount(); }
    @Override public void onListenerDisconnected() { withdraw(this); }

    static boolean accessGranted(Context context) {
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        return manager != null && manager.isNotificationListenerAccessGranted(
                new ComponentName(context, PhoneNotificationCounter.class));
    }

    private void recount() {
        StatusBarNotification[] active;
        try {
            active = getActiveNotifications();
        } catch (SecurityException | IllegalStateException notConnected) {
            return;
        }
        if (active == null) return;
        int total = 0;
        for (StatusBarNotification sbn : active) {
            if (NotificationTotals.counts(sbn.getNotification().flags, sbn.isClearable(),
                    getPackageName().equals(sbn.getPackageName()))) total++;
        }
        send(this, NotificationTotals.cap(total));
    }

    private static void send(Context context, int count) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (prefs.getInt(SENT, -1) == count) return;
        PutDataMapRequest data = PutDataMapRequest.create(NotificationTotals.DATA_PATH);
        data.getDataMap().putInt(NotificationTotals.COUNT, count);
        PutDataRequest request = data.asPutDataRequest().setUrgent();
        Wearable.getDataClient(context).putDataItem(request)
                .addOnSuccessListener(item -> prefs.edit().putInt(SENT, count).apply());
    }

    /** Removes the phone's count so the watch stops adding a stale number. */
    static void withdraw(Context context) {
        Uri uri = Uri.parse("wear://*" + NotificationTotals.DATA_PATH);
        Wearable.getDataClient(context).deleteDataItems(uri, com.google.android.gms.wearable.DataClient.FILTER_LITERAL)
                .addOnSuccessListener(deleted -> context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                        .edit().remove(SENT).apply());
    }
}
