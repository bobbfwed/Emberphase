package com.bobbfwed.emberphase.health.phone;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import androidx.work.*;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.bobbfwed.emberphase.health.common.SnapshotCodec;
import com.google.android.gms.tasks.Tasks;
import com.google.android.gms.wearable.*;
import java.util.concurrent.TimeUnit;

final class HealthSync {
    private static final String PERIODIC = "health-periodic";
    private static final String IMMEDIATE = "health-immediate";
    private static final int SCHEDULE_VERSION = 2;
    private static long lastWatchRequest;
    private HealthSync() { }
    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("health_sync", Context.MODE_PRIVATE);
    }
    static boolean enabled(Context context) { return prefs(context).getBoolean("enabled", false); }
    static void enable(Context context) {
        synchronized (HealthSync.class) {
            prefs(context).edit().putBoolean("enabled", true).putBoolean("pending_clear", false)
                    .putInt("schedule_version", SCHEDULE_VERSION).apply();
        }
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, periodic());
        request(context, true);
    }
    /** Replace an older 30-minute schedule once, without restarting it on every run. */
    static void ensureSchedule(Context context) {
        if (!enabled(context)) return;
        synchronized (HealthSync.class) {
            SharedPreferences prefs = prefs(context);
            if (prefs.getInt("schedule_version", 0) == SCHEDULE_VERSION) return;
            prefs.edit().putInt("schedule_version", SCHEDULE_VERSION).apply();
        }
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.UPDATE, periodic());
    }
    private static PeriodicWorkRequest periodic() {
        Constraints constraints = new Constraints.Builder().setRequiresBatteryNotLow(true).build();
        return new PeriodicWorkRequest.Builder(HealthSyncWorker.class, 60, TimeUnit.MINUTES, 15, TimeUnit.MINUTES)
                .setConstraints(constraints).build();
    }
    static synchronized void request(Context context, boolean urgent) {
        if (!enabled(context)) return;
        long now = android.os.SystemClock.elapsedRealtime();
        if (!urgent && lastWatchRequest > 0 && now - lastWatchRequest < ActivitySnapshot.BACKGROUND_REFRESH_GAP.toMillis()) return;
        lastWatchRequest = now;
        WorkManager.getInstance(context).enqueueUniqueWork(IMMEDIATE, ExistingWorkPolicy.KEEP,
                new OneTimeWorkRequest.Builder(HealthSyncWorker.class)
                        .setInputData(new Data.Builder().putBoolean("urgent", urgent).build())
                        .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build());
    }
    // The same lock prevents an in-flight sync from restoring data after Stop.
    static synchronized void publish(Context context, ActivitySnapshot snapshot, boolean urgent) throws Exception {
        if (!enabled(context)) return;
        PutDataMapRequest data = PutDataMapRequest.create(ActivitySnapshot.DATA_PATH);
        data.getDataMap().putAll(SnapshotCodec.encode(snapshot));
        PutDataRequest request = data.asPutDataRequest();
        if (urgent) request.setUrgent();
        SharedPreferences prefs = prefs(context);
        String fingerprint = HealthPublish.fingerprint(snapshot);
        long now = System.currentTimeMillis();
        if (!HealthPublish.shouldWrite(urgent, prefs.contains(HealthPublish.FINGERPRINT) && prefs.contains(HealthPublish.EXPIRES),
                prefs.getString(HealthPublish.FINGERPRINT, null), prefs.getLong(HealthPublish.EXPIRES, 0), fingerprint, now)) {
            prefs.edit().putLong(HealthPublish.LAST_CHECK, now).apply();
            return;
        }
        Tasks.await(Wearable.getDataClient(context).putDataItem(request), 20, TimeUnit.SECONDS);
        prefs.edit().putLong("last_sync", snapshot.capturedAt.toEpochMilli())
                .putLong(HealthPublish.LAST_CHECK, now)
                .putString(HealthPublish.FINGERPRINT, fingerprint)
                .putLong(HealthPublish.EXPIRES, snapshot.expiresAt.toEpochMilli())
                .putString("status", "Synced with paired watch. Samsung Health may take time to sync watch activity to the phone.").apply();
    }
    static synchronized void stop(Context context, String reason) {
        prefs(context).edit().putBoolean("enabled", false).putBoolean("pending_clear", true)
                .remove("last_sync").remove(HealthPublish.FINGERPRINT).remove(HealthPublish.EXPIRES)
                .remove(HealthPublish.LAST_CHECK).putString("status", reason).apply();
        WorkManager.getInstance(context).cancelUniqueWork(PERIODIC);
        WorkManager.getInstance(context).cancelUniqueWork(IMMEDIATE);
        if (!clearPending(context)) {
            WorkManager.getInstance(context).enqueueUniqueWork("health-clear", ExistingWorkPolicy.KEEP,
                    new OneTimeWorkRequest.Builder(HealthSyncWorker.class)
                            .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 1, TimeUnit.MINUTES).build());
        }
    }
    static synchronized boolean clearPending(Context context) {
        if (enabled(context) || !prefs(context).getBoolean("pending_clear", false)) return true;
        // Called on a background thread. Data Layer propagates deletion to the paired watch.
        try {
            Tasks.await(Wearable.getDataClient(context).deleteDataItems(
                    Uri.parse("wear://*" + ActivitySnapshot.DATA_PATH), DataClient.FILTER_LITERAL), 20, TimeUnit.SECONDS);
            prefs(context).edit().putBoolean("pending_clear", false).apply();
            return true;
        } catch (Exception unavailable) {
            return false;
        }
    }
}
