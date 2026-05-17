package com.basketball.launcher;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;

public class LaunchActivity extends Activity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("exp://192.168.1.6:8085"));
        intent.setPackage("host.exp.exponent");
        try {
            startActivity(intent);
        } catch (Exception e) {
            Intent fallback = new Intent(Intent.ACTION_VIEW);
            fallback.setData(Uri.parse("exp://192.168.1.6:8085"));
            startActivity(fallback);
        }
        finish();
    }
}
