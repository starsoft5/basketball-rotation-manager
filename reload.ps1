adb shell am force-stop host.exp.exponent
adb shell am start -a android.intent.action.VIEW -d "exp://10.0.2.2:8085" host.exp.exponent
Write-Host "App reloaded on Pixel 7" -ForegroundColor Green
