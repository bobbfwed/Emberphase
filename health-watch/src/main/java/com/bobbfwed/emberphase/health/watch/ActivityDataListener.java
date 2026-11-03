package com.bobbfwed.emberphase.health.watch;

import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.google.android.gms.wearable.DataEvent;
import com.google.android.gms.wearable.DataEventBuffer;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.WearableListenerService;

public final class ActivityDataListener extends WearableListenerService {
    @Override public void onDataChanged(DataEventBuffer events) {
        for (DataEvent event : events) {
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
}
