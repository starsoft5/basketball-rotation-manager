import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share, Alert } from "react-native";

const APP_NAME = "Basketball Rotation";
const SHARE_MESSAGE = `🏀 Check out ${APP_NAME}!\n\nManage player rotations for your pickup basketball games. Fair playing time for everyone!\n\nAsk me for the APK to install it on your Android device.`;

async function shareApp() {
  try {
    await Share.share({
      message: SHARE_MESSAGE,
      title: APP_NAME,
    });
  } catch (e) {
    Alert.alert("Error", "Could not open share dialog.");
  }
}

export default function ShareScreen() {
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <Text style={s.emoji}>📲</Text>
      <Text style={s.title}>Share to Another Device</Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>Share this App</Text>
        <Text style={s.description}>
          Send the app to friends and teammates so they can install it on their Android devices.
        </Text>

        <TouchableOpacity style={s.shareButton} onPress={shareApp} activeOpacity={0.8}>
          <Text style={s.shareButtonText}>📤 Share App</Text>
        </TouchableOpacity>

        <View style={s.divider} />

        <Text style={s.howTitle}>How to install on another device:</Text>
        <Text style={s.step}>1. Share the APK file via Bluetooth, WhatsApp, or any file-sharing app</Text>
        <Text style={s.step}>2. On the other device, open the APK file</Text>
        <Text style={s.step}>3. Allow "Install from unknown sources" if prompted</Text>
        <Text style={s.step}>4. Tap Install and enjoy! 🏀</Text>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: "#0F172A" },
  container: {
    flexGrow: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FB923C",
    marginBottom: 20,
    textAlign: "center",
  },
  card: {
    backgroundColor: "#1E293B",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    alignItems: "center",
  },
  cardTitle: {
    color: "#F1F5F9",
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 8,
  },
  description: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
  shareButton: {
    backgroundColor: "#F97316",
    paddingVertical: 16,
    paddingHorizontal: 40,
    borderRadius: 16,
    width: "100%",
  },
  shareButtonText: {
    color: "#FFF",
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  divider: {
    height: 1,
    backgroundColor: "#334155",
    width: "100%",
    marginVertical: 20,
  },
  howTitle: {
    color: "#F1F5F9",
    fontSize: 16,
    fontWeight: "bold",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  step: {
    color: "#CBD5E1",
    fontSize: 14,
    alignSelf: "flex-start",
    marginBottom: 8,
    lineHeight: 20,
  },
});
