package com.bobbfwed.emberphase.health.watch;

import android.app.Application;

/** Starts the power-saving and low-light listeners for every companion process. */
public final class EmberphaseApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        PowerSaveSignals.listen(this);
        BrightnessSignals.listen(this);
    }
}
