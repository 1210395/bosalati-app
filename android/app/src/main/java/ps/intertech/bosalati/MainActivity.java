package ps.intertech.bosalati;

import android.Manifest;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebView;

import androidx.annotation.NonNull;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BosalatiCamera";
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 100;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install native crash handler FIRST — writes crash log to file
        installCrashHandler();

        super.onCreate(savedInstanceState);

        nativeLog("onCreate started");
        nativeLog("Android version: " + android.os.Build.VERSION.SDK_INT);
        nativeLog("Device: " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);

        // Request camera permission proactively on startup
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            nativeLog("Requesting camera permission from OS...");
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA},
                    CAMERA_PERMISSION_REQUEST_CODE);
        } else {
            nativeLog("Camera permission already granted");
        }

        // Configure WebView AFTER a short delay to let Capacitor's bridge fully init
        // IMPORTANT: Do NOT call setWebChromeClient — it replaces Capacitor's internal
        // BridgeWebChromeClient and breaks everything. Instead, we use Capacitor's
        // built-in permission handling via the bridge.
        getWindow().getDecorView().post(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    nativeLog("ERROR: WebView is null after bridge init");
                    return;
                }

                // Enable WebView debugging
                WebView.setWebContentsDebuggingEnabled(true);
                nativeLog("WebView debugging enabled");

                // Allow autoplay of media (camera streams)
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                nativeLog("MediaPlaybackRequiresUserGesture set to false");

                // Log WebView info
                nativeLog("WebView URL: " + webView.getUrl());
                nativeLog("WebView UA: " + webView.getSettings().getUserAgentString().substring(0, Math.min(80, webView.getSettings().getUserAgentString().length())));

                nativeLog("WebView configured successfully — NOT overriding WebChromeClient");

            } catch (Exception e) {
                nativeLog("ERROR configuring WebView: " + e.getMessage());
                logException(e);
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                nativeLog("Camera permission GRANTED by user");
            } else {
                nativeLog("Camera permission DENIED by user");
            }
        }
    }

    // =========================================
    // Native file-based logging
    // =========================================
    private void nativeLog(String message) {
        Log.d(TAG, message);
        writeToLogFile("NATIVE: " + message);
    }

    private void logException(Exception e) {
        StringWriter sw = new StringWriter();
        e.printStackTrace(new PrintWriter(sw));
        writeToLogFile("EXCEPTION:\n" + sw.toString());
    }

    private void writeToLogFile(String message) {
        try {
            String ts = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(new Date());
            String line = "[" + ts + "] " + message + "\n";

            // Write to app's external files directory (accessible via file manager)
            // Path: Android/data/ps.intertech.bosalati/files/bosalati_crash.log
            File dir = getExternalFilesDir(null);
            if (dir != null) {
                File logFile = new File(dir, "bosalati_crash.log");
                FileWriter fw = new FileWriter(logFile, true); // append mode
                fw.write(line);
                fw.flush();
                fw.close();
            }

            // Also try writing to Downloads-accessible location
            // Path: /sdcard/bosalati_crash.log
            try {
                File sdcard = android.os.Environment.getExternalStorageDirectory();
                File downloadLog = new File(sdcard, "bosalati_crash.log");
                FileWriter fw2 = new FileWriter(downloadLog, true);
                fw2.write(line);
                fw2.flush();
                fw2.close();
            } catch (Exception e) {
                // May not have permission, that's OK
            }

        } catch (Exception e) {
            Log.e(TAG, "Failed to write log file: " + e.getMessage());
        }
    }

    // =========================================
    // Native crash handler — catches Java crashes and writes to file
    // =========================================
    private void installCrashHandler() {
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();

        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                StringWriter sw = new StringWriter();
                throwable.printStackTrace(new PrintWriter(sw));

                String crashLog = "\n\n========== NATIVE CRASH ==========\n" +
                        "Time: " + new Date().toString() + "\n" +
                        "Thread: " + thread.getName() + "\n" +
                        "Exception: " + throwable.getClass().getName() + "\n" +
                        "Message: " + throwable.getMessage() + "\n" +
                        "Stack:\n" + sw.toString() +
                        "==================================\n\n";

                // Write to multiple locations for maximum chance of finding it
                writeToLogFile(crashLog);

                Log.e(TAG, "NATIVE CRASH LOGGED TO FILE");
                Log.e(TAG, crashLog);

            } catch (Exception e) {
                Log.e(TAG, "Failed to log crash: " + e.getMessage());
            }

            // Call the default handler to let Android show the crash dialog
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        // Write a startup marker so we know the app launched
        writeToLogFile("\n=== APP STARTED === " + new Date().toString());
    }
}
