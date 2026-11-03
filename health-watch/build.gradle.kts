plugins { id("com.android.application") }

android {
    namespace = "com.bobbfwed.emberphase.health.watch"
    compileSdk = 36
    defaultConfig {
        // Data Layer peers must share application ID and signing certificate.
        applicationId = "com.bobbfwed.emberphase.health"
        minSdk = 36
        targetSdk = 36
        versionCode = 2004
        versionName = "0.1.3"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}
dependencies {
    implementation(project(":health-common"))
    implementation("androidx.wear.watchface:watchface-complications-data-source:1.3.0")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("junit:junit:4.13.2")
    testImplementation("junit:junit:4.13.2")
}
