package com.bobbfwed.emberphase.health.watch;

public final class CoreTapReceiver extends TapReceiver {
    @Override TapTiming timing() { return TapTiming.CORE_TAP; }
    @Override String prefsName() { return "core_tap"; }
    @Override Class<? extends TapDataSource> source() { return CoreTapDataSource.class; }
}
