import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Jellyfin } from "../lib/jellyfin";
import { formatTime } from "../lib/gesture";
import type { MediaItem, Preferences } from "../types";
import { Button, colors, ErrorNote, Icon, IconButton, ui } from "../ui";
export const isFolder = (item: MediaItem) =>
  item.IsFolder ||
  [
    "CollectionFolder",
    "Folder",
    "Series",
    "Season",
    "BoxSet",
    "UserView",
  ].includes(item.Type || "");
function Cover({
  item,
  api,
  wide = false,
}: {
  item: MediaItem;
  api: Jellyfin;
  wide?: boolean;
}) {
  const uri = api.image(
    item,
    wide && item.BackdropImageTags?.length ? "Backdrop" : "Primary",
    wide ? 900 : 480,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return (
    <View
      style={[
        s.cover,
        wide && { aspectRatio: 1.9 },
        isFolder(item) && { backgroundColor: "#24372d" },
      ]}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <Icon
            name={isFolder(item) ? "folder-open-outline" : "film-outline"}
            color="#94aa95"
            size={wide ? 52 : 38}
          />
          <Text numberOfLines={2} style={s.fallback}>
            {item.Name}
          </Text>
        </>
      )}
      {isFolder(item) && (
        <View style={s.coverBadge}>
          <Icon name="folder" size={12} />
          <Text style={{ color: colors.text, fontSize: 10 }}>文件夹</Text>
        </View>
      )}
    </View>
  );
}
export default function Library({
  api,
  prefs,
  refreshKey,
  onPreferences,
  onPlay,
  onSettings,
}: {
  api: Jellyfin;
  prefs: Preferences;
  refreshKey: number;
  onPreferences: (p: Preferences) => void;
  onPlay: (item: MediaItem) => void;
  onSettings: () => void;
}) {
  const [path, setPath] = useState<MediaItem[]>([]);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [resume, setResume] = useState<MediaItem[]>([]);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const generation = useRef(0);
  const morePending = useRef(false);
  const { width } = useWindowDimensions();
  const columns = prefs.list ? 1 : width > 700 ? 4 : 2;
  const parent = path.at(-1);
  useEffect(() => {
    const t = setTimeout(() => setQuery(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    const abort = new AbortController();
    const current = ++generation.current;
    setBusy(true);
    setError("");
    setItems([]);
    setTotal(0);
    setMore(false);
    morePending.current = false;
    const load = async () => {
      try {
        if (!parent && !query) {
          const views = await api.views(abort.signal);
          if (current === generation.current) {
            setItems(views);
            setTotal(views.length);
          }
        } else {
          const result = await api.items(
            parent?.Id || "",
            0,
            query,
            abort.signal,
          );
          if (current === generation.current) {
            setItems(result.Items);
            setTotal(result.TotalRecordCount);
          }
        }
      } catch (e) {
        if (!abort.signal.aborted)
          setError(e instanceof Error ? e.message : "媒体库加载失败");
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    };
    void load();
    return () => {
      abort.abort();
      generation.current++;
    };
  }, [api, parent?.Id, query, reload, refreshKey]);
  useEffect(() => {
    const abort = new AbortController();
    void api
      .resume(abort.signal)
      .then(setResume)
      .catch(() => setResume([]));
    return () => abort.abort();
  }, [api, reload, refreshKey]);
  async function loadMore() {
    if (morePending.current || busy || items.length >= total) return;
    morePending.current = true;
    setMore(true);
    const current = generation.current;
    try {
      const result = await api.items(parent?.Id || "", items.length, query);
      if (current === generation.current)
        setItems((old) => [
          ...old,
          ...result.Items.filter(
            (next) => !old.some((existing) => existing.Id === next.Id),
          ),
        ]);
    } catch (e) {
      if (current === generation.current)
        setError(e instanceof Error ? e.message : "加载失败");
    } finally {
      if (current === generation.current) {
        setMore(false);
        morePending.current = false;
      }
    }
  }
  function open(item: MediaItem) {
    if (isFolder(item)) {
      setPath((p) => [...p, item]);
      setSearch("");
      setQuery("");
    } else onPlay(item);
  }
  const header = (
    <View>
      <View
        style={[ui.row, { justifyContent: "space-between", marginBottom: 25 }]}
      >
        <View style={[ui.row, { gap: 10 }]}>
          <View style={s.logo}>
            <Icon name="play" size={19} color={colors.black} />
          </View>
          <Text style={s.brand}>still</Text>
        </View>
        <View style={[ui.row, { gap: 4 }]}>
          <View style={s.connected} />
          <Text style={{ color: colors.muted, fontSize: 12 }}>Jellyfin</Text>
          <IconButton
            name="settings-outline"
            label="设置"
            onPress={onSettings}
          />
        </View>
      </View>
      <View style={[ui.row, { gap: 8 }]}>
        {!!parent && (
          <IconButton
            name="arrow-back"
            label="上一级文件夹"
            onPress={() => {
              setPath((p) => p.slice(0, -1));
              setSearch("");
              setQuery("");
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          <Text style={ui.label}>
            {parent ? "FOLDERS / 文件夹" : "YOUR PERSONAL CINEMA"}
          </Text>
          <Text style={ui.title}>{parent?.Name || "我的媒体库"}</Text>
        </View>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[ui.row, { gap: 8, marginVertical: 16 }]}
      >
        <Pressable
          onPress={() => {
            setPath([]);
            setSearch("");
            setQuery("");
          }}
        >
          <Text style={{ color: colors.muted }}>媒体库</Text>
        </Pressable>
        {path.map((p, i) => (
          <View key={p.Id} style={[ui.row, { gap: 8 }]}>
            <Icon name="chevron-forward" size={12} color={colors.muted} />
            <Pressable
              onPress={() => {
                setPath(path.slice(0, i + 1));
                setSearch("");
                setQuery("");
              }}
            >
              <Text
                style={{
                  color: i === path.length - 1 ? colors.accent : colors.muted,
                }}
              >
                {p.Name}
              </Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={s.search}>
        <Icon name="search-outline" size={18} color={colors.muted} />
        <TextInput
          accessibilityLabel="搜索媒体"
          value={search}
          onChangeText={setSearch}
          placeholder={parent ? "搜索这个文件夹及子目录" : "搜索全部媒体"}
          placeholderTextColor={colors.muted}
          style={{ flex: 1, color: colors.text, fontSize: 15, height: 44 }}
          returnKeyType="search"
          autoCorrect={false}
        />
        {!!search && (
          <IconButton
            name="close"
            label="清空搜索"
            onPress={() => setSearch("")}
          />
        )}
      </View>
      {!parent && !query && !!resume.length && (
        <View style={{ marginTop: 28 }}>
          <Text style={s.sectionTitle}>接着上次看</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{
              gap: 14,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            {resume.map((item) => (
              <Pressable
                key={item.Id}
                accessibilityRole="button"
                accessibilityLabel={`继续播放 ${item.Name}`}
                onPress={() => onPlay(item)}
                style={{ width: Math.min(width - 60, 340) }}
              >
                <Cover item={item} api={api} wide />
                <View style={s.resumeLine}>
                  <View
                    style={{
                      height: 2,
                      width: `${Math.min(100, ((item.UserData?.PlaybackPositionTicks || 0) / (item.RunTimeTicks || 1)) * 100)}%`,
                      backgroundColor: colors.accent,
                    }}
                  />
                </View>
                <Text numberOfLines={1} style={[s.name, { marginTop: 12 }]}>
                  {item.Name}
                </Text>
                <Text style={s.detail}>
                  已观看{" "}
                  {formatTime(
                    (item.UserData?.PlaybackPositionTicks || 0) / 1e7,
                  )}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      <View
        style={[
          ui.row,
          { justifyContent: "space-between", marginTop: 24, marginBottom: 10 },
        ]}
      >
        <Text style={s.sectionTitle}>
          {query ? "搜索结果" : parent ? "文件夹内容" : "媒体文件夹"}{" "}
          <Text style={{ fontSize: 12, color: colors.muted }}> {total}</Text>
        </Text>
        <IconButton
          name={prefs.list ? "grid-outline" : "list-outline"}
          label="切换显示布局"
          onPress={() => onPreferences({ ...prefs, list: !prefs.list })}
        />
      </View>
      {!!error && (
        <View style={{ gap: 10, marginBottom: 16 }}>
          <ErrorNote text={error} />
          <Button secondary onPress={() => setReload((n) => n + 1)}>
            重新加载
          </Button>
        </View>
      )}
    </View>
  );
  return (
    <SafeAreaView style={ui.page} edges={["top", "left", "right"]}>
      <FlatList
        key={columns}
        data={items}
        numColumns={columns}
        keyExtractor={(i) => i.Id}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: 24, paddingBottom: 48 }}
        columnWrapperStyle={columns > 1 ? { gap: 14 } : undefined}
        keyboardShouldPersistTaps="handled"
        refreshing={busy}
        onRefresh={() => setReload((n) => n + 1)}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${isFolder(item) ? "打开文件夹" : "播放"} ${item.Name}`}
            onPress={() => open(item)}
            style={[
              s.card,
              { width: (width - 48 - 14 * (columns - 1)) / columns },
              prefs.list && s.listCard,
            ]}
          >
            <View style={prefs.list ? { width: 74 } : undefined}>
              <Cover item={item} api={api} />
            </View>
            <View
              style={
                prefs.list
                  ? { flex: 1, paddingHorizontal: 15 }
                  : { paddingTop: 12 }
              }
            >
              <Text style={s.name} numberOfLines={2}>
                {item.Name}
              </Text>
              <Text style={s.detail}>
                {isFolder(item)
                  ? item.ChildCount === undefined
                    ? "浏览文件夹"
                    : `${item.ChildCount} 个项目`
                  : [
                      item.ProductionYear,
                      item.RunTimeTicks
                        ? formatTime(item.RunTimeTicks / 1e7)
                        : "视频",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
              </Text>
            </View>
            {prefs.list && (
              <Icon
                name={isFolder(item) ? "chevron-forward" : "play-outline"}
                size={18}
                color={colors.muted}
              />
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          busy ? (
            <ActivityIndicator color={colors.accent} style={{ margin: 32 }} />
          ) : !error ? (
            <View
              style={{ paddingVertical: 45, alignItems: "center", gap: 14 }}
            >
              <Icon name="folder-open-outline" size={40} color={colors.muted} />
              <Text style={ui.subtitle}>
                {query ? "没有找到匹配的视频或文件夹" : "这个文件夹还没有内容"}
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          items.length < total ? (
            <Button secondary busy={more} onPress={loadMore}>
              加载更多
            </Button>
          ) : (
            <Text
              style={[
                ui.subtitle,
                { textAlign: "center", fontSize: 11, marginTop: 24 },
              ]}
            >
              你的媒体，你的节奏。
            </Text>
          )
        }
      />
    </SafeAreaView>
  );
}
const s = StyleSheet.create({
  brand: {
    fontSize: 32,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: -1.5,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  connected: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  search: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 13,
    paddingLeft: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: colors.text },
  card: { marginBottom: 22 },
  cover: {
    aspectRatio: 1.25,
    borderRadius: 15,
    overflow: "hidden",
    backgroundColor: "#242e35",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  fallback: {
    color: "#bdd0c2",
    fontSize: 13,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  coverBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    backgroundColor: "#09100bbf",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 6,
  },
  name: { color: colors.text, fontSize: 15, fontWeight: "500", lineHeight: 22 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 5 },
  listCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: 10,
    borderRadius: 15,
    marginBottom: 10,
  },
  resumeLine: {
    height: 2,
    backgroundColor: colors.line,
    marginTop: -2,
    marginHorizontal: 12,
  },
});
