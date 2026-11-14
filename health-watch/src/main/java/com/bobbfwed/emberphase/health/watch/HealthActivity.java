package com.bobbfwed.emberphase.health.watch;

import android.app.Activity;
import android.os.Bundle;
import android.widget.*;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

public final class HealthActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        ScrollView scroll = new ScrollView(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (32 * getResources().getDisplayMetrics().density);
        content.setPadding(padding, padding, padding, padding);
        scroll.addView(content);
        TextView title = new TextView(this);
        title.setText("Emberphase Health"); title.setTextSize(21); content.addView(title);
        ActivitySnapshot snapshot = SnapshotStore.read(this);
        TextView status = new TextView(this);
        status.setTextSize(15);
        status.setText(snapshot != null && snapshot.isFresh(Instant.now(), ZoneId.systemDefault())
                ? "Phone data updated " + DateTimeFormatter.ofPattern("HH:mm").withZone(ZoneId.systemDefault()).format(snapshot.capturedAt)
                : "Open Emberphase Health on your phone to connect Samsung Health and allow activity and goal access.");
        content.addView(status);
        Button refresh = new Button(this);
        refresh.setText("Sync from phone");
        refresh.setOnClickListener(view -> {
            PhoneRefresh.loadCache(this);
            PhoneRefresh.request(this, true);
            status.setText("Requested a phone sync. The phone app must have Samsung Health permission.");
        });
        content.addView(refresh);
        TextView help = new TextView(this);
        help.setText("In the face editor, select the MIN value and choose Emberphase · Active minutes. Select CAL and choose Emberphase · Active calories.");
        help.setTextSize(15); content.addView(help);
        TextView notifications = new TextView(this);
        notifications.setTextSize(15);
        notifications.setText(NotificationCount.accessGranted(this)
                ? "Watch notification count: on."
                : "Watch notification count: off. Phone notifications are counted by the phone app; allow notification access there.");
        content.addView(notifications);
        setContentView(scroll);
        PhoneRefresh.loadCache(this);
    }
}
