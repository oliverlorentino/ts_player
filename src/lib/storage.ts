import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";
import { defaults, type Preferences, type Session } from "../types";
const SESSION = "still.session.v1";
export const saveSession = (session: Session) =>
  SecureStore.setItemAsync(SESSION, JSON.stringify(session), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
export const clearSession = () => SecureStore.deleteItemAsync(SESSION);
export async function readSession(): Promise<Session | null> {
  const raw = await SecureStore.getItemAsync(SESSION);
  if (!raw) return null;
  try {
    const s = JSON.parse(raw);
    return s.server && s.token && s.userId && s.deviceId ? s : null;
  } catch {
    return null;
  }
}
export async function deviceId() {
  let id = await AsyncStorage.getItem("still.device");
  if (!id) {
    id = Crypto.randomUUID();
    await AsyncStorage.setItem("still.device", id);
  }
  return id;
}
export async function readPreferences(): Promise<Preferences> {
  try {
    const value = JSON.parse(
      (await AsyncStorage.getItem("still.preferences")) || "{}",
    );
    return { ...defaults, ...value };
  } catch {
    return defaults;
  }
}
export const savePreferences = (prefs: Preferences) =>
  AsyncStorage.setItem("still.preferences", JSON.stringify(prefs));
function progressKey(s: Session, id: string) {
  return `still.progress:${s.server}:${s.userId}:${id}`;
}
export async function savePosition(
  session: Session,
  id: string,
  seconds: number,
) {
  await AsyncStorage.setItem(
    progressKey(session, id),
    JSON.stringify({ seconds, updated: Date.now() }),
  );
}
export async function readPosition(
  session: Session,
  id: string,
  serverSeconds: number,
) {
  try {
    const raw = await AsyncStorage.getItem(progressKey(session, id));
    if (raw) {
      const value = JSON.parse(raw);
      if (
        Date.now() - value.updated < 86400000 &&
        Number.isFinite(value.seconds)
      )
        return value.seconds as number;
    }
  } catch {
    /* A damaged local checkpoint must not prevent playback. */
  }
  return serverSeconds;
}
