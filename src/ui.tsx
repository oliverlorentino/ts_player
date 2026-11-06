import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
export const colors = {
  bg: "#0b1011",
  surface: "#151d1e",
  lifted: "#1e2829",
  line: "#293334",
  text: "#edf2e9",
  muted: "#92a19d",
  accent: "#c4ed98",
  black: "#142014",
  error: "#ffb7a8",
};
export function Icon({
  name,
  size = 22,
  color = colors.text,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  size?: number;
  color?: string;
}) {
  return <Ionicons name={name} size={size} color={color} />;
}
export function IconButton({
  name,
  label,
  onPress,
  style,
}: {
  name: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        ui.iconButton,
        style,
        pressed && { opacity: 0.55 },
      ]}
    >
      <Icon name={name} />
    </Pressable>
  );
}
export function Button({
  children,
  onPress,
  secondary = false,
  busy = false,
}: {
  children: React.ReactNode;
  onPress: () => void;
  secondary?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [
        ui.button,
        secondary && { backgroundColor: colors.lifted },
        (pressed || busy) && { opacity: 0.65 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={secondary ? colors.accent : colors.black} />
      ) : (
        <Text style={[ui.buttonText, secondary && { color: colors.text }]}>
          {children}
        </Text>
      )}
    </Pressable>
  );
}
export function ErrorNote({ text }: { text: string }) {
  return (
    <View accessibilityRole="alert" style={ui.error}>
      <Icon name="alert-circle-outline" color={colors.error} />
      <Text style={{ color: colors.error, flex: 1, lineHeight: 22 }}>
        {text}
      </Text>
    </View>
  );
}
export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  text: { color: colors.text },
  muted: { color: colors.muted },
  title: {
    fontSize: 30,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -0.8,
  },
  subtitle: { fontSize: 14, color: colors.muted, lineHeight: 23 },
  row: { flexDirection: "row", alignItems: "center" },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    color: colors.text,
    padding: 16,
    fontSize: 16,
    minHeight: 54,
  },
  iconButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    backgroundColor: colors.accent,
    minHeight: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  buttonText: { fontSize: 16, fontWeight: "700", color: colors.black },
  error: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#301e1c",
    borderRadius: 12,
    padding: 14,
    alignItems: "flex-start",
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1,
    marginBottom: 10,
  },
});
