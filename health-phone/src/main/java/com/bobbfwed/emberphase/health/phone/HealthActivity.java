package com.bobbfwed.emberphase.health.phone;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.widget.*;
import com.samsung.android.sdk.health.data.error.ResolvablePlatformException;
import java.text.DateFormat;
import java.util.Date;
import java.util.concurrent.Executors;

public final class HealthActivity extends Activity {
    private TextView status;
    private final android.content.SharedPreferences.OnSharedPreferenceChangeListener changes = (prefs, key) -> runOnUiThread(this::refresh);
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        HealthSync.ensureSchedule(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(32, 72, 32, 48);
        ScrollView scroll = new ScrollView(this); scroll.addView(content); setContentView(scroll);
        TextView title = new TextView(this); title.setText("Emberphase Health"); title.setTextSize(28); content.addView(title);
        TextView explanation = new TextView(this);
        explanation.setText("Share today's active minutes, active calories and their daily goals from Samsung Health with your paired watch. Read access only. No raw records or health data are sent to an Emberphase server.\n\nAutomatic sync runs about every hour when Android permits, and waits while the phone battery is low. Sync now still runs immediately. Phone and watch must stay paired. Data disappears after two hours without an update, or at midnight.\n");
        content.addView(explanation);
        status = new TextView(this); content.addView(status);
        button(content, "Connect Samsung Health", this::connect);
        button(content, "Sync now", () -> background(() -> HealthSync.request(this, true)));
        button(content, "Stop sharing and clear watch data", () -> {
            background(() -> HealthSync.stop(this, "Sharing stopped. Read access can also be revoked in Samsung Health's data permissions."));
        });
        button(content, "Samsung SDK setup documentation", () -> startActivity(new Intent(Intent.ACTION_VIEW,
                Uri.parse("https://developer.samsung.com/health/data/process.html"))));
        TextView instructions = new TextView(this);
        instructions.setText("\nOn the watch, edit Emberphase → Complications. Tap the MIN number and choose Emberphase · Active minutes. Tap CAL and choose Emberphase · Active calories.\n\nThis local developer build requires Samsung's SDK testing setup. Public distribution requires Samsung partner registration.");
        content.addView(instructions);
    }
    private void button(LinearLayout parent, String label, Runnable action) {
        Button button = new Button(this); button.setText(label); button.setOnClickListener(view -> action.run()); parent.addView(button);
    }
    private void background(Runnable action) {
        var executor = Executors.newSingleThreadExecutor();
        executor.execute(action);
        executor.shutdown();
    }
    @Override public void onResume() { super.onResume(); refresh(); }
    @Override public void onStart() { super.onStart(); HealthSync.prefs(this).registerOnSharedPreferenceChangeListener(changes); }
    @Override public void onStop() { HealthSync.prefs(this).unregisterOnSharedPreferenceChangeListener(changes); super.onStop(); }
    private void refresh() {
        long synced = HealthSync.prefs(this).getLong("last_sync", 0);
        status.setText((HealthSync.enabled(this) ? "Sharing enabled.\n" : "Sharing stopped.\n")
                + HealthSync.prefs(this).getString("status", "Connect to grant Samsung Health read permission.")
                + (synced == 0 ? "" : "\nLast sync: " + DateFormat.getDateTimeInstance().format(new Date(synced))));
    }
    private void connect() {
        try {
            SamsungHealthReader.store(this).requestPermissionsAsync(SamsungHealthReader.PERMISSIONS, this)
                    .setCallback(getMainExecutor(), granted -> {
                        if (granted.containsAll(SamsungHealthReader.PERMISSIONS)) background(() -> HealthSync.enable(this));
                        else {
                            background(() -> HealthSync.stop(this, "Allow all three read permissions to show both activity goals."));
                        }
                        refresh();
                    }, this::error);
        } catch (RuntimeException failure) { error(failure); }
    }
    private void error(Throwable failure) {
        if (failure instanceof ResolvablePlatformException resolvable && resolvable.getHasResolution()) {
            resolvable.resolve(this);
        } else {
            status.setText("Samsung Health is not ready. Check its setup and read permissions. For this local developer build, complete the official Samsung Health Data SDK testing setup, then reconnect. (" + failure.getClass().getSimpleName() + ")");
        }
    }
}
