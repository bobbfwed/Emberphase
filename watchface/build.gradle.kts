import java.util.zip.ZipFile

plugins { id("com.android.application") }

android {
    namespace = "com.bobbfwed.emberphase"
    compileSdk = 36
    buildToolsVersion = "36.0.0"
    defaultConfig {
        applicationId = "com.bobbfwed.emberphase"
        minSdk = 36
        targetSdk = 36
        versionCode = 15
        versionName = "0.4.8"
    }
    buildTypes {
        // AGP emits resource R classes even without source code. R8 removes
        // those unused generated classes; resource shrinking stays off because
        // WFF resolves artwork and editor-string names at runtime.
        debug { isMinifyEnabled = true; isShrinkResources = false }
        release { isMinifyEnabled = true; isShrinkResources = false }
    }
}

tasks.register("verifyResourceOnlyDebug") {
    val apk = layout.buildDirectory.file("outputs/apk/debug/watchface-debug.apk")
    dependsOn("assembleDebug")
    inputs.file(apk)
    doLast {
        ZipFile(apk.get().asFile).use { archive ->
            check(archive.entries().asSequence().none { it.name.endsWith(".dex") }) {
                "WFF must be resource-only: the APK contains DEX code."
            }
            check(archive.getEntry("res/raw/watchface.xml") != null) {
                "The packaged watchface.xml is missing."
            }
        }
        logger.lifecycle("Verified resource-only WFF APK: {}", apk.get().asFile)
    }
}
