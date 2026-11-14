package com.bobbfwed.emberphase.health.common;

import android.app.Notification;

/**
 * Shared rule for counting notifications on the phone and the watch, and the
 * Data Layer item that carries the phone's count to the watch. Phone
 * notifications reach the watch only through Wear OS's private stream, so the
 * watch cannot count them itself.
 */
public final class NotificationTotals {
    public static final String DATA_PATH = "/emberphase/notifications/v1";
    public static final String COUNT = "count";
    public static final int MAX = 99;
    private static final int NOT_COUNTED = Notification.FLAG_ONGOING_EVENT
            | Notification.FLAG_FOREGROUND_SERVICE | Notification.FLAG_GROUP_SUMMARY;

    private NotificationTotals() { }

    /** Counts what a person would dismiss: not ongoing, not a group header, not ours. */
    public static boolean counts(int flags, boolean clearable, boolean own) {
        return clearable && !own && (flags & NOT_COUNTED) == 0;
    }

    public static int cap(int count) { return Math.max(0, Math.min(count, MAX)); }
}
