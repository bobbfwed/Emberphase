package com.bobbfwed.emberphase.health.phone;

import com.bobbfwed.emberphase.health.common.ActivitySnapshot;

/** Decides whether an hourly health sync needs a Data Layer write. */
final class HealthPublish {
    static final long MARGIN_MILLIS = 75L * 60L * 1000L;
    static final String FINGERPRINT = "published_fingerprint";
    static final String EXPIRES = "published_expiry";
    static final String LAST_CHECK = "last_check";

    private HealthPublish() { }

    /** Day plus the whole numbers the watch actually draws. */
    static String fingerprint(ActivitySnapshot snapshot) {
        return snapshot.day + "|"
                + whole(snapshot.minutes.value) + "|" + whole(snapshot.minutes.goal) + "|"
                + whole(snapshot.calories.value) + "|" + whole(snapshot.calories.goal);
    }

    static boolean shouldWrite(boolean urgent, boolean hasPublished, String publishedFingerprint,
            long publishedExpiryMillis, String fingerprint, long nowMillis) {
        if (urgent || !hasPublished || publishedFingerprint == null || !publishedFingerprint.equals(fingerprint)) {
            return true;
        }
        return publishedExpiryMillis - nowMillis <= MARGIN_MILLIS;
    }

    private static String whole(Double value) {
        return value == null ? "" : Long.toString(Math.round(value));
    }
}
