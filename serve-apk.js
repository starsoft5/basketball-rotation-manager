const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 9090;
const qrDir = path.join(__dirname, "qrcodes");

const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];

  if (url === "/basketball.apk") {
    const apkPath = path.join(qrDir, "basketball.apk");
    const stat = fs.statSync(apkPath);
    res.writeHead(200, {
      "Content-Type": "application/vnd.android.package-archive",
      "Content-Length": stat.size,
      "Content-Disposition": "attachment; filename=basketball.apk",
    });
    fs.createReadStream(apkPath).pipe(res);
    return;
  }

  if (url === "/expo-qr.png" || url === "/apk-qr.png") {
    const filePath = path.join(qrDir, url.slice(1));
    if (fs.existsSync(filePath)) {
      const stat = fs.statSync(filePath);
      res.writeHead(200, { "Content-Type": "image/png", "Content-Length": stat.size });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
    return;
  }

  const html = `<!DOCTYPE html><html><head><title>Basketball Rotation</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:sans-serif;background:#0F172A;color:#FFF;text-align:center;padding:20px}
img{max-width:280px;margin:16px auto;display:block;border-radius:12px}
h1{color:#FB923C;font-size:24px}h2{color:#94A3B8;font-size:16px}
.card{background:#1E293B;border-radius:16px;padding:20px;margin:16px auto;max-width:360px}
a{color:#FB923C;font-size:18px;display:inline-block;margin-top:12px;text-decoration:none}
.step{color:#CBD5E1;font-size:14px;text-align:left;margin:8px 0}
.emoji{font-size:48px}</style></head>
<body>
<p class="emoji">&#x1F3C0;</p>
<h1>Basketball Rotation</h1>

<div class="card">
<h2>Option 1: Open in Expo Go</h2>
<p class="step">1. Install <b>Expo Go</b> from Play Store</p>
<p class="step">2. Scan this QR with Expo Go app</p>
<img src="/expo-qr.png" alt="Expo QR">
<p style="color:#64748B;font-size:12px">exp://192.168.1.6:8085</p>
</div>

<div class="card">
<h2>Option 2: Install Launcher APK</h2>
<p class="step">1. Tap link or scan QR to download</p>
<p class="step">2. Install APK (allow unknown sources)</p>
<p class="step">3. Basketball icon on home screen!</p>
<img src="/apk-qr.png" alt="APK QR">
<br><a href="/basketball.apk">&#x2B07; Download Basketball.apk</a>
</div>
</body></html>`;

  res.writeHead(200, { "Content-Type": "text/html" });
  res.end(html);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`\nServing at http://192.168.1.6:${PORT}`);
  console.log(`APK download: http://192.168.1.6:${PORT}/basketball.apk`);
  console.log(`\nOpen this URL on your phone browser to see QR codes and download.\n`);
});
