package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;

/** Core tap for the Meniscus face: starts a short fluid slosh. */
public final class CoreTapDataSource extends TapDataSource {
    @Override TapTiming timing() { return TapTiming.CORE_TAP; }
    @Override String prefsName() { return "core_tap"; }
    @Override Class<? extends BroadcastReceiver> receiver() { return CoreTapReceiver.class; }
    @Override int requestCode() { return 2; }
    @Override String description() { return "Slosh the core"; }
}
