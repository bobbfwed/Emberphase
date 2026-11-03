package com.bobbfwed.emberphase.health.common;

import com.google.android.gms.wearable.DataMap;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;

/** Small, versioned Data Layer payload. It contains no raw health records. */
public final class SnapshotCodec {
    private SnapshotCodec() { }

    public static DataMap encode(ActivitySnapshot snapshot) {
        DataMap map = new DataMap();
        map.putInt("schema", ActivitySnapshot.SCHEMA);
        map.putString("day", snapshot.day.toString());
        map.putString("zone", snapshot.zone.getId());
        map.putLong("captured", snapshot.capturedAt.toEpochMilli());
        map.putLong("expires", snapshot.expiresAt.toEpochMilli());
        putMetric(map, "minutes", snapshot.minutes);
        putMetric(map, "calories", snapshot.calories);
        return map;
    }

    public static ActivitySnapshot decode(DataMap map) {
        if (map.getInt("schema", -1) != ActivitySnapshot.SCHEMA) {
            throw new IllegalArgumentException("Unsupported activity snapshot schema");
        }
        return new ActivitySnapshot(LocalDate.parse(map.getString("day")),
                ZoneId.of(map.getString("zone")), Instant.ofEpochMilli(map.getLong("captured")),
                Instant.ofEpochMilli(map.getLong("expires")), metric(map, "minutes"), metric(map, "calories"));
    }

    private static void putMetric(DataMap map, String name, ActivitySnapshot.Metric metric) {
        map.putBoolean(name + "_has_value", metric.value != null);
        map.putBoolean(name + "_has_goal", metric.goal != null);
        if (metric.value != null) map.putDouble(name + "_value", metric.value);
        if (metric.goal != null) map.putDouble(name + "_goal", metric.goal);
    }

    private static ActivitySnapshot.Metric metric(DataMap map, String name) {
        return new ActivitySnapshot.Metric(optional(map, name, "value"), optional(map, name, "goal"));
    }

    private static Double optional(DataMap map, String name, String field) {
        if (!map.getBoolean(name + "_has_" + field)) return null;
        String key = name + "_" + field;
        if (!map.containsKey(key)) throw new IllegalArgumentException("Incomplete activity metric");
        return map.getDouble(key);
    }
}
