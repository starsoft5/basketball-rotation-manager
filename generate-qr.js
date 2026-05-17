const QRCode = require("qrcode");
const path = require("path");

const LAN_IP = "192.168.1.6";
const PORT = 8085;

const expoUrl = `exp://${LAN_IP}:${PORT}`;
const apkUrl = `http://${LAN_IP}:9090/basketball.apk`;

async function generate() {
  const outDir = path.join(__dirname, "qrcodes");
  require("fs").mkdirSync(outDir, { recursive: true });

  await QRCode.toFile(path.join(outDir, "expo-qr.png"), expoUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000", light: "#FFF" },
  });
  console.log(`Expo QR: ${expoUrl}`);
  console.log(`  -> saved to qrcodes/expo-qr.png`);

  await QRCode.toFile(path.join(outDir, "apk-qr.png"), apkUrl, {
    width: 400,
    margin: 2,
    color: { dark: "#000", light: "#FFF" },
  });
  console.log(`APK QR: ${apkUrl}`);
  console.log(`  -> saved to qrcodes/apk-qr.png`);

  const terminalQr = await QRCode.toString(expoUrl, { type: "terminal", small: true });
  console.log("\n--- Scan this with Expo Go ---");
  console.log(terminalQr);
}

generate().catch(console.error);
