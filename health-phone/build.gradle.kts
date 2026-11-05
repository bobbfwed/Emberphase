plugins { id("com.android.application") }

val samsungSdk = rootProject.file(".tools/samsung-health/samsung-health-data-api-1.1.0.aar")
android {
    namespace = "com.bobbfwed.emberphase.health.phone"
    compileSdk = 36
    defaultConfig {
        applicationId = "com.bobbfwed.emberphase.health"
        minSdk = 29
        targetSdk = 36
        versionCode = 1004
        versionName = "0.1.3"
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

tasks.named("preBuild") {
    val sdkFile = samsungSdk
    doFirst {
        check(sdkFile.isFile) {
            "Download Samsung Health Data SDK 1.1.0 with your Samsung account, then run scripts/Import-SamsungHealthSdk.ps1 -ZipPath <downloaded-sdk.zip>."
        }
    }
}
dependencies {
    implementation(project(":health-common"))
    implementation(files(samsungSdk))
    implementation("androidx.work:work-runtime:2.12.0")
    implementation("org.jetbrains.kotlin:kotlin-stdlib:2.1.20")
    // The local AAR has no POM; DataResponse's parcelers need this at runtime.
    implementation("org.jetbrains.kotlin:kotlin-parcelize-runtime:2.1.20")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    implementation("com.google.code.gson:gson:2.13.2")
    testImplementation("junit:junit:4.13.2")
}
