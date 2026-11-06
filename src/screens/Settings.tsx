import React from "react";
import { ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Preferences, Session } from "../types";
import { Button, colors, IconButton, ui } from "../ui";
function Choices({
  title,
  note,
  values,
  value,
  change,
}: {
  title: string;
  note: string;
  values: [number, string][];
  value: number;
  change: (n: number) => void;
}) {
  return (
    <View style={s.section}>
      <Text style={s.heading}>{title}</Text>
      <Text style={[ui.subtitle, { marginTop: 7, marginBottom: 16 }]}>
        {note}
      </Text>
      <View style={[ui.row, { flexWrap: "wrap", gap: 8 }]}>
        {values.map(([n, label]) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ selected: n === value }}
            onPress={() => change(n)}
            key={n}
            style={[s.chip, n === value && s.selected]}
          >
            <Text style={{ color: n === value ? colors.black : colors.text }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export default function Settings({
  prefs,
  session,
  onChange,
  onClose,
  onLogout,
}: {
  prefs: Preferences;
  session: Session;
  onChange: (p: Preferences) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  return (
    <SafeAreaView style={ui.page}>
      <View style={[ui.row, { padding: 16, gap: 10 }]}>
        <IconButton name="arrow-back" label="返回" onPress={onClose} />
        <Text style={[ui.title, { fontSize: 24 }]}>按你的习惯</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 0 }}>
        <Choices
          title="滑动灵敏度"
          note="手指横向滑过一屏时，跳转的时间。滑动不暂停，也不弹出控件。"
          values={[
            [60, "精细 · 60 秒"],
            [120, "标准 · 120 秒"],
            [300, "快速 · 5 分钟"],
          ]}
          value={prefs.swipeSeconds}
          change={(swipeSeconds) => onChange({ ...prefs, swipeSeconds })}
        />
        <Choices
          title="双击快进 / 后退"
          note="双击画面左半侧后退，右半侧快进。不显示跳转提示。单击才显示控制按钮。"
          values={[
            [5, "5 秒"],
            [10, "10 秒"],
            [15, "15 秒"],
            [30, "30 秒"],
          ]}
          value={prefs.doubleTapSeconds}
          change={(doubleTapSeconds) =>
            onChange({ ...prefs, doubleTapSeconds })
          }
        />
        <Choices
          title="网络缓冲"
          note="VLC 网络缓冲目标。大缓冲更抗网络波动，但首次播放和跳转可能更慢；不是离线下载。"
          values={[
            [500, "灵敏 · 0.5 秒"],
            [1500, "均衡 · 1.5 秒"],
            [3000, "稳定 · 3 秒"],
            [5000, "弱网 · 5 秒"],
          ]}
          value={prefs.networkCacheMs}
          change={(networkCacheMs) => onChange({ ...prefs, networkCacheMs })}
        />
        <Choices
          title="流媒体码率上限"
          note="默认优先原片直放。超过上限时让 Jellyfin 协商转码，降低带宽需求。"
          values={[
            [120000000, "原画优先 · 120M"],
            [40000000, "40 Mbps"],
            [20000000, "20 Mbps"],
            [8000000, "8 Mbps"],
          ]}
          value={prefs.bitrate}
          change={(bitrate) => onChange({ ...prefs, bitrate })}
        />
        <View style={s.section}>
          <Text style={s.heading}>已连接</Text>
          <Text selectable style={[ui.subtitle, { marginTop: 12 }]}>
            {session.userName} · {session.server}
          </Text>
          <Text style={[ui.subtitle, { marginVertical: 16 }]}>
            {
              "Still 0.1 · VLC 播放内核\n支持硬件解码的格式由内核自动选择。特殊编码、HDR 与杜比视界的显示效果需要真机验证。"
            }
          </Text>
          <Button secondary onPress={onLogout}>
            退出当前账号
          </Button>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  section: {
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  heading: { color: colors.text, fontSize: 18, fontWeight: "600" },
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent },
});
