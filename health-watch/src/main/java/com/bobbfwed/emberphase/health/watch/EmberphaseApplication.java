package com.bobbfwed.emberphase.health.watch;

import android.app.Application;

/** Starts the power-saving listener for every companion process. */
public final class EmberphaseApplication extends Application {
    @Override public void onCreate() {
        super.onCreate();
        PowerSaveSignals.listen(this);
    }
}
