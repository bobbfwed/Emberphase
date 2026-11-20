package com.bobbfwed.emberphase.health.watch;

public final class SweepReceiver extends TapReceiver {
    @Override TapTiming timing() { return TapTiming.SWEEP; }
    @Override String prefsName() { return "mechanical_sweep"; }
    @Override Class<? extends TapDataSource> source() { return SweepDataSource.class; }
}
