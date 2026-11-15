package net.mm9pdy.codeplugstudio;

import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Keeps the screen on while a long radio job runs, by setting FLAG_KEEP_SCREEN_ON on the activity window. The
 * WebView's navigator.wakeLock is not reliable, so the native app uses this instead. The flag clears itself when the
 * activity goes away; the web side calls allowSleep() when the job ends.
 */
@CapacitorPlugin(name = "KeepAwake")
public class KeepAwakePlugin extends Plugin {

  @PluginMethod
  public void keepAwake(PluginCall call) {
    setKeepScreenOn(true);
    call.resolve();
  }

  @PluginMethod
  public void allowSleep(PluginCall call) {
    setKeepScreenOn(false);
    call.resolve();
  }

  private void setKeepScreenOn(boolean on) {
    getActivity()
      .runOnUiThread(() -> {
        Window window = getActivity().getWindow();
        if (on) {
          window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        } else {
          window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
      });
  }
}
