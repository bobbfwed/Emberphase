package com.bobbfwed.emberphase.health.watch;

import android.content.Context;
import android.net.Uri;
import com.bobbfwed.emberphase.health.common.ActivitySnapshot;
import com.google.android.gms.wearable.DataClient;
import com.google.android.gms.wearable.DataItem;
import com.google.android.gms.wearable.DataMapItem;
import com.google.android.gms.wearable.Node;
import com.google.android.gms.wearable.Wearable;

final class PhoneRefresh {
    private static long lastRequest;
    private PhoneRefresh() { }

    static void loadCache(Context context) {
        Context app = context.getApplicationContext();
        Wearable.getDataClient(app).getDataItems(Uri.parse("wear://*" + ActivitySnapshot.DATA_PATH), DataClient.FILTER_LITERAL)
                .addOnSuccessListener(items -> {
                    try {
                        for (DataItem item : items) {
                            if (ActivitySnapshot.DATA_PATH.equals(item.getUri().getPath())) {
                                SnapshotStore.accept(app, DataMapItem.fromDataItem(item).getDataMap());
                            }
                        }
                    } finally { items.release(); }
                });
    }

    static synchronized void request(Context context, boolean userInitiated) {
        long now = android.os.SystemClock.elapsedRealtime();
        if (!userInitiated && lastRequest > 0 && now - lastRequest < 300_000) return;
        lastRequest = now;
        Context app = context.getApplicationContext();
        Wearable.getNodeClient(app).getConnectedNodes().addOnSuccessListener(nodes -> {
            for (Node node : nodes) {
                Wearable.getMessageClient(app).sendMessage(node.getId(), ActivitySnapshot.REFRESH_PATH,
                        new byte[]{(byte) (userInitiated ? 1 : 0)});
            }
        });
    }
}
