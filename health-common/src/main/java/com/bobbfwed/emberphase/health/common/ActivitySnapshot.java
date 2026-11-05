package com.bobbfwed.emberphase.health.common;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Objects;

/** One consented, dated reading; unknown values are null, never synthetic zeroes. */
public final class ActivitySnapshot {
    public static final int SCHEMA = 1;
    public static final String DATA_PATH = "/emberphase/activity/v1";
    public static final String REFRESH_PATH = "/emberphase/activity/refresh";
    public static final Duration MAX_AGE = Duration.ofHours(3);
    /** Minimum gap between automatic Samsung Health reads. Manual sync is not limited. */
    public static final Duration BACKGROUND_REFRESH_GAP = Duration.ofMinutes(15);

    public final LocalDate day;
    public final ZoneId zone;
    public final Instant capturedAt;
    public final Instant expiresAt;
    public final Metric minutes;
    public final Metric calories;

    public ActivitySnapshot(LocalDate day, ZoneId zone, Instant capturedAt,
                            Instant expiresAt, Metric minutes, Metric calories) {
        this.day = Objects.requireNonNull(day);
        this.zone = Objects.requireNonNull(zone);
        this.capturedAt = Objects.requireNonNull(capturedAt);
        this.expiresAt = Objects.requireNonNull(expiresAt);
        this.minutes = Objects.requireNonNull(minutes);
        this.calories = Objects.requireNonNull(calories);
        Instant midnight = day.plusDays(1).atStartOfDay(zone).toInstant();
        if (!capturedAt.atZone(zone).toLocalDate().equals(day)
                || !expiresAt.isAfter(capturedAt)
                || expiresAt.isAfter(capturedAt.plus(MAX_AGE))
                || expiresAt.isAfter(midnight)) {
            throw new IllegalArgumentException("Invalid activity snapshot interval");
        }
    }

    public static ActivitySnapshot create(Instant now, ZoneId zone, Metric minutes, Metric calories) {
        LocalDate day = now.atZone(zone).toLocalDate();
        Instant midnight = day.plusDays(1).atStartOfDay(zone).toInstant();
        Instant expiry = now.plus(MAX_AGE);
        if (midnight.isBefore(expiry)) expiry = midnight;
        return new ActivitySnapshot(day, zone, now, expiry, minutes, calories);
    }

    public boolean isFresh(Instant now, ZoneId displayZone) {
        return !now.isBefore(capturedAt.minus(Duration.ofMinutes(5)))
                && now.isBefore(expiresAt)
                && now.atZone(zone).toLocalDate().equals(day)
                && now.atZone(displayZone).toLocalDate().equals(day);
    }

    public static final class Metric {
        public final Double value;
        public final Double goal;

        public Metric(Double value, Double goal) {
            if (value != null && (!Double.isFinite(value) || !Float.isFinite(value.floatValue()) || value < 0)) {
                throw new IllegalArgumentException("Invalid activity value");
            }
            if (goal != null && (!Double.isFinite(goal) || !Float.isFinite(goal.floatValue()) || goal <= 0)) {
                throw new IllegalArgumentException("Invalid activity goal");
            }
            this.value = value;
            this.goal = goal;
        }

        public boolean hasProgress() { return value != null && goal != null; }
    }
}
