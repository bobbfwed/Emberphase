package com.bobbfwed.emberphase.health.phone;

import android.content.Context;
import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import com.samsung.android.sdk.health.data.error.AuthorizationException;

public final class HealthSyncWorker extends Worker {
    public HealthSyncWorker(@NonNull Context context, @NonNull WorkerParameters parameters) { super(context, parameters); }
    @NonNull @Override public Result doWork() {
        Context context = getApplicationContext();
        if (!HealthSync.enabled(context)) {
            return HealthSync.clearPending(context) ? Result.success() : Result.retry();
        }
        try {
            var snapshot = SamsungHealthReader.read(context);
            if (!isStopped()) HealthSync.publish(context, snapshot, getInputData().getBoolean("urgent", false));
            return Result.success();
        } catch (SecurityException | AuthorizationException revoked) {
            HealthSync.stop(context, "Samsung Health access is unavailable. Check SDK setup and reconnect to grant read permission.");
            return Result.failure();
        } catch (Exception unavailable) {
            // Never log health payloads or SDK errors that may contain records.
            HealthSync.prefs(context).edit().putString("status", "Sync unavailable. Open Samsung Health, check read permissions, then try Sync now.").apply();
            return getRunAttemptCount() < 2 ? Result.retry() : Result.failure();
        }
    }
}
