package me.sharik.blockjr;

import android.Manifest;
import android.os.Build;
import android.content.pm.PackageManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  protected void onCreate(android.os.Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    // Request Bluetooth permissions on Android 12+
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED ||
          checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
        requestPermissions(new String[]{
          Manifest.permission.BLUETOOTH_CONNECT,
          Manifest.permission.BLUETOOTH_SCAN
        }, 1);
      }
    }
  }
}