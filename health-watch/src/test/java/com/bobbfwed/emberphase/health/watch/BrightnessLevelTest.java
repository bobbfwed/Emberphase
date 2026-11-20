package com.bobbfwed.emberphase.health.watch;

import static org.junit.Assert.*;
import org.junit.Test;

public class BrightnessLevelTest {
    @Test public void thresholdsAreFifteenAndTwentyPercent() {
        assertEquals(15, BrightnessLevel.LOW_LIGHT_ON_PERCENT);
        assertEquals(20, BrightnessLevel.LOW_LIGHT_OFF_PERCENT);
    }

    @Test public void percentUsesTheDeviceRange() {
        assertEquals(0, BrightnessLevel.percent(0, 0, 255));
        assertEquals(100, BrightnessLevel.percent(255, 0, 255));
        assertEquals(50, BrightnessLevel.percent(50, 0, 100));
        // Tested watch in the dark under auto brightness: 39/255 = 15.3%, shown as 15%.
        assertEquals(15, BrightnessLevel.percent(39, 0, 255));
        assertEquals(16, BrightnessLevel.percent(40, 0, 255));
        assertEquals(20, BrightnessLevel.percent(51, 0, 255));
        // A non-zero minimum is the zero point.
        assertEquals(0, BrightnessLevel.percent(10, 10, 110));
        assertEquals(15, BrightnessLevel.percent(25, 10, 110));
    }

    @Test public void outOfRangeValuesAreClamped() {
        assertEquals(0, BrightnessLevel.percent(0, 1, 255));
        assertEquals(100, BrightnessLevel.percent(4095, 0, 255));
    }

    @Test public void invalidRangeFallsBackToOneTo255() {
        assertFalse(BrightnessLevel.validRange(-1, -1));
        assertFalse(BrightnessLevel.validRange(255, 255));
        assertFalse(BrightnessLevel.validRange(255, 1));
        assertTrue(BrightnessLevel.validRange(0, 255));
        int fallback = BrightnessLevel.percent(39, 1, 255);
        assertEquals(fallback, BrightnessLevel.percent(39, -1, -1));
        assertEquals(fallback, BrightnessLevel.percent(39, 255, 255));
        assertEquals(fallback, BrightnessLevel.percent(39, 255, 1));
        assertEquals(15, fallback);
    }

    @Test public void unknownValueIsUnknownAndNeverLowLight() {
        assertEquals(BrightnessLevel.UNKNOWN, BrightnessLevel.percent(-1, 0, 255));
        assertFalse(BrightnessLevel.lowLight(BrightnessLevel.UNKNOWN, false));
        assertFalse(BrightnessLevel.lowLight(BrightnessLevel.UNKNOWN, true));
    }

    @Test public void turnsOnAtOrBelowFifteenPercent() {
        assertTrue(BrightnessLevel.lowLight(15, false));
        assertTrue(BrightnessLevel.lowLight(0, false));
        assertTrue(BrightnessLevel.lowLight(15, true));
    }

    @Test public void turnsOffAtOrAboveTwentyPercent() {
        assertFalse(BrightnessLevel.lowLight(20, true));
        assertFalse(BrightnessLevel.lowLight(100, true));
        assertFalse(BrightnessLevel.lowLight(20, false));
    }

    @Test public void bandBetweenKeepsThePreviousState() {
        for (int percent = 16; percent <= 19; percent++) {
            assertTrue(BrightnessLevel.lowLight(percent, true));
            assertFalse(BrightnessLevel.lowLight(percent, false));
        }
    }

    @Test public void hysteresisFollowsASlider() {
        boolean low = false;
        int[] percents = {40, 18, 15, 17, 19, 20, 17, 16, 15};
        boolean[] expected = {false, false, true, true, true, false, false, false, true};
        for (int i = 0; i < percents.length; i++) {
            low = BrightnessLevel.lowLight(percents[i], low);
            assertEquals("step " + i, expected[i], low);
        }
    }
}
