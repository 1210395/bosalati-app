package ps.intertech.bosalati;

import android.Manifest;
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

public class MainActivity extends BridgeActivity {

    private static final String TAG = "BosalatiCamera";
    private static final int CAMERA_PERMISSION_REQUEST_CODE = 100;
    private PermissionRequest pendingPermissionRequest = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Log.d(TAG, "onCreate: Requesting camera permission proactively");
        requestCameraPermission();

        // Wait a moment for the bridge to fully initialize, then configure WebView
        // We post to the main thread to ensure the bridge/webview is ready
        getWindow().getDecorView().post(() -> {
            try {
                WebView webView = this.bridge.getWebView();
                if (webView == null) {
                    Log.e(TAG, "WebView is null!");
                    return;
                }

                // Enable WebView debugging
                WebView.setWebContentsDebuggingEnabled(true);
                Log.d(TAG, "WebView debugging enabled");

                // Get the existing WebChromeClient (Capacitor's BridgeWebChromeClient)
                // and wrap it to add camera permission handling WITHOUT replacing it
                final WebChromeClient existingClient = getExistingChromeClient(webView);

                webView.setWebChromeClient(new WebChromeClient() {
                    @Override
                    public void onPermissionRequest(final PermissionRequest request) {
                        Log.d(TAG, "onPermissionRequest called");
                        String[] resources = request.getResources();
                        for (String r : resources) {
                            Log.d(TAG, "  Requested resource: " + r);
                        }

                        // Check if camera permission is already granted at OS level
                        if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                == PackageManager.PERMISSION_GRANTED) {
                            Log.d(TAG, "Camera permission already granted, granting WebView request");
                            runOnUiThread(() -> request.grant(request.getResources()));
                        } else {
                            Log.d(TAG, "Camera permission NOT granted, requesting from OS");
                            pendingPermissionRequest = request;
                            requestCameraPermission();
                        }
                    }

                    @Override
                    public void onPermissionRequestCanceled(PermissionRequest request) {
                        Log.d(TAG, "onPermissionRequestCanceled");
                        if (pendingPermissionRequest == request) {
                            pendingPermissionRequest = null;
                        }
                    }
                });
                Log.d(TAG, "Custom WebChromeClient set for camera permissions");

                // Also ensure WebView settings allow camera
                webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setAllowFileAccess(true);
                Log.d(TAG, "WebView settings configured");

            } catch (Exception e) {
                Log.e(TAG, "Error configuring WebView: " + e.getMessage(), e);
            }
        });
    }

    /**
     * Try to get the existing WebChromeClient from the WebView via reflection.
     * This is a best-effort helper — if it fails, we just proceed.
     */
    private WebChromeClient getExistingChromeClient(WebView webView) {
        try {
            java.lang.reflect.Field field = android.webkit.WebView.class.getDeclaredField("mProvider");
            // This is fragile and not critical — we just log and move on
        } catch (Exception e) {
            // Expected to fail, not critical
        }
        return null;
    }

    private void requestCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            Log.d(TAG, "Requesting camera permission from OS...");
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA},
                    CAMERA_PERMISSION_REQUEST_CODE);
        } else {
            Log.d(TAG, "Camera permission already granted at OS level");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);

        if (requestCode == CAMERA_PERMISSION_REQUEST_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "Camera permission GRANTED by user");
                if (pendingPermissionRequest != null) {
                    Log.d(TAG, "Granting pending WebView permission request");
                    final PermissionRequest req = pendingPermissionRequest;
                    pendingPermissionRequest = null;
                    runOnUiThread(() -> req.grant(req.getResources()));
                }
            } else {
                Log.w(TAG, "Camera permission DENIED by user");
                if (pendingPermissionRequest != null) {
                    pendingPermissionRequest.deny();
                    pendingPermissionRequest = null;
                }
            }
        }
    }
}
