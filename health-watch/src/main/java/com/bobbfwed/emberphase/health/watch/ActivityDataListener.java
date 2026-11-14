package com.bobbfwed.emberphase.health.watch;

import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.bobbfwed.emberphase.health.common.NotificationTotals;
import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

public final class ActivityDataListener extends WearableListenerService {
    @Override public void onDataChanged(DataEventBuffer events) {
        for (DataEvent event : events) {
            if (NotificationTotals.DATA_PATH.equals(event.getDataItem().getUri().getPath())) {
                phoneNotifications(event);
                continue;
            }
            if (!ActivitySnapshot.DATA_PATH.equals(event.getDataItem().getUri().getPath())) continue;
            if (event.getType() == DataEvent.TYPE_DELETED) {
                SnapshotStore.clear(this);
            } else if (event.getType() == DataEvent.TYPE_CHANGED) {
                try {
                    SnapshotStore.accept(this, DataMapItem.fromDataItem(event.getDataItem()).getDataMap());
                } catch (RuntimeException invalid) {
                    SnapshotStore.clear(this);
                }
            }
        }
    }

    private void phoneNotifications(DataEvent event) {
        if (event.getType() == DataEvent.TYPE_DELETED) {
            NotificationCount.setPhone(this, null);
        } else if (event.getType() == DataEvent.TYPE_CHANGED) {
            var map = DataMapItem.fromDataItem(event.getDataItem()).getDataMap();
            NotificationCount.setPhone(this, map.containsKey(NotificationTotals.COUNT)
                    ? NotificationTotals.cap(map.getInt(NotificationTotals.COUNT)) : null);
        }
    }
}
