package com.bobbfwed.emberphase.health.watch;

import android.app.PendingIntent;
import android.content.Intent;
import androidx.wear.watchface.complications.data.*;
import androidx.wear.watchface.complications.datasource.ComplicationDataSourceService;
import androidx.wear.watchface.complications.datasource.ComplicationRequest;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import java.text.NumberFormat;
import java.time.Instant;
import java.time.ZoneId;

public abstract class ActivityDataSource extends ComplicationDataSourceService {
    protected abstract boolean isMinutes();

    @Override public void onComplicationActivated(int id, ComplicationType type) {
        super.onComplicationActivated(id, type);
        PhoneRefresh.loadCache(this);
        // A fresh cache needs no Samsung Health read. Wrist raises stay local.
        ActivitySnapshot snapshot = SnapshotStore.read(this);
        if (snapshot == null || !snapshot.isFresh(Instant.now(), ZoneId.systemDefault())) {
            PhoneRefresh.request(this, false);
        }
    }

    @Override public void onComplicationRequest(ComplicationRequest request, ComplicationRequestListener listener) {
        ActivitySnapshot snapshot = SnapshotStore.read(this);
        if (snapshot == null || !snapshot.isFresh(Instant.now(), ZoneId.systemDefault())) {
            PhoneRefresh.request(this, false);
            deliver(listener, new NoDataComplicationData());
            return;
        }
        ActivitySnapshot.Metric metric = isMinutes() ? snapshot.minutes : snapshot.calories;
        ComplicationData data = render(request.getComplicationType(), metric,
                TimeRange.between(snapshot.capturedAt, snapshot.expiresAt));
        try {
            listener.onComplicationDataTimeline(SnapshotTimeline.create(
                    snapshot, data, Instant.now(), ZoneId.systemDefault()));
        } catch (android.os.RemoteException disconnected) {
            // A later push or system refresh retries after a face transition.
        }
    }

    private void deliver(ComplicationRequestListener listener, ComplicationData data) {
        try { listener.onComplicationData(data); }
        catch (android.os.RemoteException disconnected) {
            // The face may close the request during a transition; the next update retries.
        }
    }

    @Override public ComplicationData getPreviewData(ComplicationType type) {
        // Editor-only fixtures. Never used as a fallback for unavailable live data.
        ActivitySnapshot.Metric fixture = isMinutes()
                ? new ActivitySnapshot.Metric(42.0, 60.0) : new ActivitySnapshot.Metric(380.0, 500.0);
        return render(type, fixture, null);
    }

    private ComplicationData render(ComplicationType type, ActivitySnapshot.Metric metric, TimeRange validity) {
        if (metric.value == null) return new NoDataComplicationData();
        NumberFormat format = NumberFormat.getNumberInstance();
        format.setMaximumFractionDigits(0);
        String label = isMinutes() ? "Active minutes" : "Active calories";
        ComplicationText text = new PlainComplicationText.Builder(format.format(metric.value)).build();
        ComplicationText description = new PlainComplicationText.Builder(label).build();
        PendingIntent tap = PendingIntent.getActivity(this, 0, new Intent(this, HealthActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (type == ComplicationType.GOAL_PROGRESS && metric.hasProgress()) {
            GoalProgressComplicationData.Builder builder = new GoalProgressComplicationData.Builder(
                    metric.value.floatValue(), metric.goal.floatValue(), description).setText(text)
                    .setTitle(new PlainComplicationText.Builder(isMinutes() ? "MIN" : "KCAL").build()).setTapAction(tap);
            if (validity != null) builder.setValidTimeRange(validity);
            return builder.build();
        }
        if (type == ComplicationType.SHORT_TEXT) {
            ShortTextComplicationData.Builder builder = new ShortTextComplicationData.Builder(text, description)
                    .setTitle(new PlainComplicationText.Builder(isMinutes() ? "MIN" : "KCAL").build()).setTapAction(tap);
            if (validity != null) builder.setValidTimeRange(validity);
            return builder.build();
        }
        return new NoDataComplicationData();
    }
}
