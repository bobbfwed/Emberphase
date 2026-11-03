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
    private static long lastWatchRequest;
    private HealthSync() { }
    static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("health_sync", Context.MODE_PRIVATE);
    }
    static boolean enabled(Context context) { return prefs(context).getBoolean("enabled", false); }
    static void enable(Context context) {
        synchronized (HealthSync.class) { prefs(context).edit().putBoolean("enabled", true).putBoolean("pending_clear", false).apply(); }
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(PERIODIC, ExistingPeriodicWorkPolicy.KEEP,
                new PeriodicWorkRequest.Builder(HealthSyncWorker.class, 30, TimeUnit.MINUTES, 10, TimeUnit.MINUTES).build());
        request(context, true);
    }
    static synchronized void request(Context context, boolean urgent) {
        if (!enabled(context)) return;
        long now = android.os.SystemClock.elapsedRealtime();
        if (!urgent && lastWatchRequest > 0 && now - lastWatchRequest < 300_000) return;
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
        Tasks.await(Wearable.getDataClient(context).putDataItem(request), 20, TimeUnit.SECONDS);
        prefs(context).edit().putLong("last_sync", snapshot.capturedAt.toEpochMilli())
                .putString("status", "Synced with paired watch. Samsung Health may take time to sync watch activity to the phone.").apply();
    }
    static synchronized void stop(Context context, String reason) {
        prefs(context).edit().putBoolean("enabled", false).putBoolean("pending_clear", true)
                .remove("last_sync").putString("status", reason).apply();
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
