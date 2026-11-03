package com.bobbfwed.emberphase.health.phone;

import android.content.Context;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.samsung.android.sdk.health.data.HealthDataService;
import com.samsung.android.sdk.health.data.HealthDataStore;
import com.samsung.android.sdk.health.data.permission.AccessType;
import com.samsung.android.sdk.health.data.permission.Permission;
import com.samsung.android.sdk.health.data.request.*;
import java.time.*;
import java.util.Set;
import java.util.concurrent.TimeUnit;

final class SamsungHealthReader {
    static final Set<Permission> PERMISSIONS = Set.of(
            Permission.of(DataTypes.ACTIVITY_SUMMARY, AccessType.READ),
            Permission.of(DataTypes.ACTIVE_TIME_GOAL, AccessType.READ),
            Permission.of(DataTypes.ACTIVE_CALORIES_BURNED_GOAL, AccessType.READ));

    static HealthDataStore store(Context context) { return HealthDataService.getStore(context); }

    static ActivitySnapshot read(Context context) throws Exception {
        HealthDataStore store = store(context);
        if (!store.getGrantedPermissionsAsync(PERMISSIONS).get(20, TimeUnit.SECONDS).containsAll(PERMISSIONS)) {
            throw new SecurityException("Samsung Health read permission is required");
        }
        ZoneId zone = ZoneId.systemDefault();
        LocalDateTime now = LocalDateTime.now(zone);
        LocalDate day = now.toLocalDate();
        LocalTimeFilter today = LocalTimeFilter.of(day.atStartOfDay(), now);
        // LAST returns the latest configured goal, including one set before this date range.
        LocalDateFilter goalDates = LocalDateFilter.of(day.minusDays(6), day, true, true);
        Duration minutes = value(store, DataType.ActivitySummaryType.TOTAL_ACTIVE_TIME
                .getRequestBuilder().setLocalTimeFilter(today).build());
        Float calories = value(store, DataType.ActivitySummaryType.TOTAL_ACTIVE_CALORIES_BURNED
                .getRequestBuilder().setLocalTimeFilter(today).build());
        Duration minutesGoal = value(store, DataType.ActiveTimeGoalType.LAST.getRequestBuilder()
                .setLocalDateFilter(goalDates).setOrdering(Ordering.DESC).build());
        Integer caloriesGoal = value(store, DataType.ActiveCaloriesBurnedGoalType.LAST.getRequestBuilder()
                .setLocalDateFilter(goalDates).setOrdering(Ordering.DESC).build());
        Instant captured = Instant.now();
        if (!captured.atZone(zone).toLocalDate().equals(day) || !ZoneId.systemDefault().equals(zone)) {
            throw new IllegalStateException("Day changed while reading; retry the next sync");
        }
        return ActivitySnapshot.create(captured, zone,
                new ActivitySnapshot.Metric(minutes == null ? null : (double) minutes.toMinutes(),
                        minutesGoal == null ? null : (double) minutesGoal.toMinutes()),
                new ActivitySnapshot.Metric(calories == null ? null : calories.doubleValue(),
                        caloriesGoal == null ? null : caloriesGoal.doubleValue()));
    }

    private static <T> T value(HealthDataStore store, AggregateRequest<T> request) throws Exception {
        var rows = store.aggregateDataAsync(request).get(20, TimeUnit.SECONDS).getDataList();
        // Ungrouped totals and LAST each return at most one aggregate. No data is not zero.
        if (rows.size() > 1) throw new IllegalStateException("Unexpected grouped health result");
        return rows.isEmpty() ? null : rows.get(0).getValue();
    }
}
