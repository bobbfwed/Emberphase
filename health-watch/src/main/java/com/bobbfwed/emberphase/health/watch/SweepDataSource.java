package com.bobbfwed.emberphase.health.watch;

import android.content.BroadcastReceiver;

/** Center-hub tap for the mechanical Emberphase face (six-second sweep). */
public final class SweepDataSource extends TapDataSource {
    @Override TapTiming timing() { return TapTiming.SWEEP; }
    @Override String prefsName() { return "mechanical_sweep"; }
    @Override Class<? extends BroadcastReceiver> receiver() { return SweepReceiver.class; }
    @Override int requestCode() { return 1; }
    @Override String description() { return "Run mechanical sweep"; }
}
