package com.bobbfwed.emberphase.health.phone;

import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.google.android.gms.wearable.MessageEvent;
import com.google.android.gms.wearable.WearableListenerService;

public final class WatchRefreshListener extends WearableListenerService {
    @Override public void onMessageReceived(MessageEvent event) {
        if (ActivitySnapshot.REFRESH_PATH.equals(event.getPath())) {
            byte[] data = event.getData();
            HealthSync.ensureSchedule(this);
            HealthSync.request(this, data.length == 1 && data[0] == 1);
        }
    }
}
