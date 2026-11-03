package com.bobbfwed.emberphase.health.watch;

import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import android.util.Base64;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceUpdateRequester;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.bobbfwed.emberphase.health.common.SnapshotCodec;
import com.google.android.gms.wearable.DataMap;
import java.time.Instant;
import java.time.ZoneId;

final class SnapshotStore {
    private SnapshotStore() { }
    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences("activity_snapshot", Context.MODE_PRIVATE);
    }

    static synchronized ActivitySnapshot read(Context context) {
        String encoded = prefs(context).getString("snapshot", null);
        if (encoded == null) return null;
        try {
            return SnapshotCodec.decode(DataMap.fromByteArray(Base64.decode(encoded, Base64.NO_WRAP)));
        } catch (RuntimeException invalid) {
            prefs(context).edit().remove("snapshot").apply();
            return null;
        }
    }

    static synchronized void accept(Context context, DataMap data) {
        try {
            ActivitySnapshot next = SnapshotCodec.decode(data);
            ActivitySnapshot current = read(context);
            if (current != null && current.isFresh(Instant.now(), ZoneId.systemDefault())
                    && next.capturedAt.isBefore(current.capturedAt)) return;
            prefs(context).edit().putString("snapshot",
                    Base64.encodeToString(SnapshotCodec.encode(next).toByteArray(), Base64.NO_WRAP)).apply();
        } catch (RuntimeException invalid) {
            prefs(context).edit().remove("snapshot").apply();
        }
        update(context);
    }

    static synchronized void clear(Context context) {
        prefs(context).edit().remove("snapshot").apply();
        update(context);
    }

    private static void update(Context context) {
        for (Class<?> provider : new Class<?>[]{MinutesDataSource.class, CaloriesDataSource.class}) {
            ComplicationDataSourceUpdateRequester.create(context, new ComponentName(context, provider)).requestUpdateAll();
        }
    }
}
