import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { login } from "../lib/jellyfin";
import { deviceId, saveSession } from "../lib/storage";
import type { Session } from "../types";
import { Button, colors, ErrorNote, Icon, ui } from "../ui";
export default function Login({ onLogin }: { onLogin: (s: Session) => void }) {
  const [server, setServer] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function connect() {
    if (!server.trim() || !username.trim()) {
      setError("请输入服务器地址和用户名。");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const session = await login(
        server,
        username.trim(),
        password,
        await deviceId(),
      );
      await saveSession(session);
      setPassword("");
      onLogin(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <SafeAreaView style={ui.page}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={s.content}
        >
          <View style={[ui.row, { gap: 10 }]}>
            <View style={s.logo}>
              <Icon name="play" color={colors.black} size={20} />
            </View>
            <Text style={s.wordmark}>still</Text>
            <Text style={s.tag}>私人影院</Text>
          </View>
          <View style={s.art}>
            <View style={s.orbit} />
            <View style={s.orbit2} />
            <Icon name="play-outline" size={64} color={colors.accent} />
            <Text style={s.artLabel}>LESS INTERFACE. MORE CINEMA.</Text>
          </View>
          <Text style={ui.title}>把影院，留给自己。</Text>
          <Text style={[ui.subtitle, { marginTop: 12, marginBottom: 30 }]}>
            {"连接你的 Jellyfin 媒体库。\n熟悉的文件夹，安静的播放体验。"}
          </Text>
          <View style={{ gap: 16 }}>
            <View>
              <Text style={ui.label}>服务器地址</Text>
              <TextInput
                accessibilityLabel="服务器地址"
                style={ui.input}
                placeholder="http://192.168.1.10:8096"
                placeholderTextColor="#65716e"
                value={server}
                onChangeText={setServer}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
                editable={!busy}
              />
            </View>
            <View>
              <Text style={ui.label}>用户名</Text>
              <TextInput
                accessibilityLabel="用户名"
                style={ui.input}
                placeholder="Jellyfin 用户名"
                placeholderTextColor="#65716e"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="username"
                editable={!busy}
              />
            </View>
            <View>
              <Text style={ui.label}>密码</Text>
              <TextInput
                accessibilityLabel="密码"
                style={ui.input}
                placeholder="输入密码"
                placeholderTextColor="#65716e"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
                editable={!busy}
                returnKeyType="go"
                onSubmitEditing={connect}
              />
            </View>
            {!!error && <ErrorNote text={error} />}
            <Button onPress={connect} busy={busy}>
              连接我的媒体库 →
            </Button>
          </View>
          <View style={[ui.row, { gap: 8, marginTop: 22 }]}>
            <Icon name="lock-closed-outline" size={14} color={colors.muted} />
            <Text style={{ fontSize: 12, color: colors.muted }}>
              密码不保存 · 登录凭据保存在 iPhone 钥匙串
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  content: {
    padding: 28,
    paddingTop: 26,
    paddingBottom: 40,
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  logo: {
    width: 32,
    height: 32,
    backgroundColor: colors.accent,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  wordmark: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "700",
    letterSpacing: -1.2,
  },
  tag: { color: colors.muted, fontSize: 12, marginLeft: "auto" },
  art: {
    height: 180,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginVertical: 24,
  },
  orbit: {
    position: "absolute",
    width: 210,
    height: 110,
    borderRadius: 110,
    borderColor: "#30463b",
    borderWidth: 1,
    transform: [{ rotate: "-24deg" }],
  },
  orbit2: {
    position: "absolute",
    width: 270,
    height: 150,
    borderRadius: 150,
    borderColor: "#203029",
    borderWidth: 1,
    transform: [{ rotate: "-24deg" }],
  },
  artLabel: {
    color: "#758b7a",
    fontSize: 9,
    letterSpacing: 2,
    position: "absolute",
    bottom: 3,
  },
});
