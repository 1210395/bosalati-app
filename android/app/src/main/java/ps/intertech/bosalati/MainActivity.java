package ps.intertech.bosalati;

import android.Manifest;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.util.Log;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
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
    private SharedPreferences prefs;
    private StringBuilder logBuffer = new StringBuilder();

    /**
     * Append to the log buffer AND SharedPreferences AND file.
     * SharedPreferences is the most reliable — it ALWAYS works.
     */
    private void log(String msg) {
        String ts = new SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(new Date());
        String line = "[" + ts + "] " + msg;
        Log.d(TAG, msg);
        logBuffer.append(line).append("\n");

        // Save to SharedPreferences (most reliable, survives any crash)
        try {
            if (prefs != null) {
                prefs.edit().putString("crash_log", logBuffer.toString()).apply();
            }
        } catch (Exception e) {
            Log.e(TAG, "SharedPrefs write failed: " + e.getMessage());
        }

        // Also try file (may fail on some devices)
        try {
            File f = new File(getFilesDir(), "bosalati_crash.log");
            FileWriter fw = new FileWriter(f, true);
            fw.write(line + "\n");
            fw.flush();
            fw.close();
        } catch (Exception e) {
            // ignore
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // SharedPreferences — the most reliable storage on any Android device
        prefs = getSharedPreferences("bosalati_debug", MODE_PRIVATE);

        // Clear previous log on fresh start
        prefs.edit().putString("crash_log", "").apply();

        log("=== APP STARTING ===");
        log("Date: " + new Date().toString());
        log("Device: " + android.os.Build.MANUFACTURER + " " + android.os.Build.MODEL);
        log("Android API: " + android.os.Build.VERSION.SDK_INT + " (" + android.os.Build.VERSION.RELEASE + ")");
        log("App internal dir: " + getFilesDir().getAbsolutePath());

        // Install Java crash handler
        final Thread.UncaughtExceptionHandler prev = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            StringWriter sw = new StringWriter();
            throwable.printStackTrace(new PrintWriter(sw));
            log("!!! JAVA CRASH on thread " + thread.getName() + " !!!");
            log(throwable.getClass().getName() + ": " + throwable.getMessage());
            log(sw.toString());
            if (prev != null) prev.uncaughtException(thread, throwable);
        });
        log("Crash handler installed - SUCCESS");

        log("Calling super.onCreate...");
        super.onCreate(savedInstanceState);
        log("super.onCreate - SUCCESS");

        // Camera permission
        boolean hasCam = ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
        log("Camera permission check: " + (hasCam ? "GRANTED" : "NOT GRANTED"));
        if (!hasCam) {
            log("Requesting camera permission...");
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA}, CAMERA_PERMISSION_REQUEST_CODE);
        }

        // Configure WebView after bridge is ready
        log("Scheduling WebView config...");
        getWindow().getDecorView().post(() -> {
            log("WebView config callback running...");
            try {
                WebView webView = getBridge().getWebView();
                log("getBridge().getWebView(): " + (webView != null ? "OK" : "NULL"));
                if (webView == null) return;

                WebView.setWebContentsDebuggingEnabled(true);
                log("WebContentsDebugging enabled - SUCCESS");

                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                log("MediaPlaybackRequiresUserGesture=false - SUCCESS");

                // Inject the log into JS so it can be displayed
                String jsLog = logBuffer.toString().replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n");
                webView.evaluateJavascript(
                    "window._nativeLog = '" + jsLog + "';" +
                    "window._hasNativeLog = true;" +
                    "console.log('[Native] Log injected into JS');",
                    null
                );
                log("Native log injected into JS - SUCCESS");

                // Wrap the existing WebChromeClient for camera permission handling
                log("Getting existing WebChromeClient...");
                final WebChromeClient original = webView.getWebChromeClient();
                log("Existing client: " + (original != null ? original.getClass().getName() : "null"));

                if (original != null) {
                    log("Setting wrapped WebChromeClient...");
                    webView.setWebChromeClient(new WrappedChromeClient(original));
                    log("Wrapped WebChromeClient set - SUCCESS");
                }

                log("=== WEBVIEW CONFIG COMPLETE ===");

            } catch (Exception e) {
                log("ERROR in WebView config: " + e.getClass().getName() + ": " + e.getMessage());
                StringWriter sw = new StringWriter();
                e.printStackTrace(new PrintWriter(sw));
                log(sw.toString());
            }
        });

        log("onCreate finished - SUCCESS");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            log("Camera permission result: " + (granted ? "GRANTED" : "DENIED"));
        }
    }

    /**
     * Wraps Capacitor's BridgeWebChromeClient — only overrides onPermissionRequest
     * and delegates everything else to the original client.
     */
    private class WrappedChromeClient extends WebChromeClient {
        private final WebChromeClient original;

        WrappedChromeClient(WebChromeClient original) {
            this.original = original;
        }

        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            log("onPermissionRequest: " + java.util.Arrays.toString(request.getResources()));
            // Always grant — the OS-level permission dialog handles the real security
            runOnUiThread(() -> {
                try {
                    request.grant(request.getResources());
                    log("WebView permission GRANTED");
                } catch (Exception e) {
                    log("ERROR granting permission: " + e.getMessage());
                }
            });
        }

        @Override public void onPermissionRequestCanceled(PermissionRequest r) { original.onPermissionRequestCanceled(r); }
        @Override public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) { return original.onConsoleMessage(cm); }
        @Override public boolean onShowFileChooser(WebView v, android.webkit.ValueCallback<android.net.Uri[]> cb, FileChooserParams p) { return original.onShowFileChooser(v, cb, p); }
        @Override public void onGeolocationPermissionsShowPrompt(String o, android.webkit.GeolocationPermissions.Callback c) { original.onGeolocationPermissionsShowPrompt(o, c); }
        @Override public boolean onCreateWindow(WebView v, boolean d, boolean u, android.os.Message m) { return original.onCreateWindow(v, d, u, m); }
        @Override public void onCloseWindow(WebView w) { original.onCloseWindow(w); }
        @Override public boolean onJsAlert(WebView v, String u, String m, android.webkit.JsResult r) { return original.onJsAlert(v, u, m, r); }
        @Override public boolean onJsConfirm(WebView v, String u, String m, android.webkit.JsResult r) { return original.onJsConfirm(v, u, m, r); }
        @Override public boolean onJsPrompt(WebView v, String u, String m, String d, android.webkit.JsPromptResult r) { return original.onJsPrompt(v, u, m, d, r); }
        @Override public void onProgressChanged(WebView v, int p) { original.onProgressChanged(v, p); }
        @Override public void onReceivedTitle(WebView v, String t) { original.onReceivedTitle(v, t); }
        @Override public void onReceivedIcon(WebView v, android.graphics.Bitmap i) { original.onReceivedIcon(v, i); }
    }
}
