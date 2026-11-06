import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, StatusBar, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Orientation from "expo-screen-orientation";
import {
  defaults,
  type MediaItem,
  type Preferences,
  type Session,
} from "./src/types";
import {
  clearSession,
  readPreferences,
  readSession,
  savePreferences,
} from "./src/lib/storage";
import { Jellyfin } from "./src/lib/jellyfin";
import Login from "./src/screens/Login";
import Library from "./src/screens/Library";
import Settings from "./src/screens/Settings";
import Player from "./src/screens/Player";
import { colors, ui } from "./src/ui";
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [prefs, setPrefs] = useState<Preferences>(defaults);
  const [settings, setSettings] = useState(false);
  const [playing, setPlaying] = useState<MediaItem>();
  const [refreshKey, setRefreshKey] = useState(0);
  const api = useMemo(
    () => (session ? new Jellyfin(session) : undefined),
    [session],
  );
  useEffect(() => {
    void Orientation.lockAsync(Orientation.OrientationLock.PORTRAIT_UP).catch(
      () => {},
    );
    void Promise.all([readSession(), readPreferences()])
      .then(([s, p]) => {
        setSession(s);
        setPrefs(p);
      })
      .catch(() => Alert.alert("无法恢复登录", "请重新连接 Jellyfin。"))
      .finally(() => setReady(true));
  }, []);
  function updatePreferences(next: Preferences) {
    setPrefs(next);
    void savePreferences(next).catch(() =>
      Alert.alert("设置未保存", "本次仍可使用，重新启动后需要再次设置。"),
    );
  }
  async function logout() {
    try {
      await clearSession();
      setSettings(false);
      setSession(null);
    } catch {
      Alert.alert("退出失败", "无法清除钥匙串凭据，请重试。");
    }
  }
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      {!ready ? (
        <View
          style={[ui.page, { alignItems: "center", justifyContent: "center" }]}
        >
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : !api || !session ? (
        <Login onLogin={setSession} />
      ) : (
        <>
          <Library
            api={api}
            prefs={prefs}
            refreshKey={refreshKey}
            onPreferences={updatePreferences}
            onPlay={setPlaying}
            onSettings={() => setSettings(true)}
          />
          <Modal
            visible={settings}
            animationType="slide"
            onRequestClose={() => setSettings(false)}
          >
            <Settings
              prefs={prefs}
              session={session}
              onChange={updatePreferences}
              onClose={() => setSettings(false)}
              onLogout={() => void logout()}
            />
          </Modal>
          <Modal
            visible={!!playing}
            animationType="fade"
            presentationStyle="fullScreen"
            supportedOrientations={[
              "portrait",
              "landscape-left",
              "landscape-right",
            ]}
            onRequestClose={() => setPlaying(undefined)}
          >
            {playing && (
              <Player
                api={api}
                item={playing}
                prefs={prefs}
                onClose={() => {
                  setPlaying(undefined);
                  setRefreshKey((n) => n + 1);
                }}
              />
            )}
          </Modal>
        </>
      )}
    </SafeAreaProvider>
  );
}
