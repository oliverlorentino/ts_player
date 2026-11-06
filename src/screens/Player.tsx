import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  PanResponder,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  VLCPlayer,
  type Track,
  type VLCPlayerSource,
} from "react-native-vlc-media-player";
import * as Orientation from "expo-screen-orientation";
import { useKeepAwake } from "expo-keep-awake";
import * as FileSystem from "expo-file-system/legacy";
import { Jellyfin } from "../lib/jellyfin";
import { clamp, formatTime, swipeTarget } from "../lib/gesture";
import { readPosition, savePosition } from "../lib/storage";
import type { MediaItem, Playback, Preferences } from "../types";
import { Button, colors, ErrorNote, IconButton, ui } from "../ui";

export default function Player({
  api,
  item,
  prefs,
  onClose,
}: {
  api: Jellyfin;
  item: MediaItem;
  prefs: Preferences;
  onClose: () => void;
}) {
  useKeepAwake();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const player = useRef<VLCPlayer>(null);
  const active = useRef(true);
  const [playback, setPlayback] = useState<Playback>();
  const playbackRef = useRef<Playback | undefined>(undefined);
  const [force, setForce] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [controls, setControls] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [position, setPosition] = useState(0);
  const positionRef = useRef(0);
  const [duration, setDuration] = useState((item.RunTimeTicks || 0) / 1e7);
  const durationRef = useRef(duration);
  const [dragPosition, setDragPosition] = useState<number>();
  const dragging = useRef(false);
  const pendingSeek = useRef<{ position: number; until: number } | undefined>(
    undefined,
  );
  const [audioTracks, setAudioTracks] = useState<Track[]>([]);
  const [textTracks, setTextTracks] = useState<Track[]>([]);
  const [audioTrack, setAudioTrack] = useState<number>();
  const [textTrack, setTextTrack] = useState<number>();
  const [subtitleUri, setSubtitleUri] = useState("");
  const [rate, setRate] = useState(1);
  const [syncError, setSyncError] = useState(false);
  const [trackError, setTrackError] = useState("");
  const initialPosition = useRef(0);
  const positionLoaded = useRef(false);
  const resumed = useRef(false);
  const started = useRef(false);
  const forceRef = useRef(force);
  forceRef.current = force;
  const tapTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const lastTap = useRef(0);
  const reportQueue = useRef(Promise.resolve());
  const cachedSubtitles = useRef<string[]>([]);
  const subtitleRequest = useRef(0);

  function report(
    event: "Playing" | "Playing/Progress" | "Playing/Stopped",
    p = playbackRef.current,
  ) {
    if (!p || !started.current) return;
    const at = positionRef.current;
    const isPaused = pausedRef.current;
    reportQueue.current = reportQueue.current
      .catch(() => {})
      .then(() => api.report(event, item.Id, p, at, isPaused))
      .then(() => {
        if (active.current) setSyncError(false);
      })
      .catch(() => {
        if (active.current) setSyncError(true);
      });
    void savePosition(api.session, item.Id, at).catch(() => {});
  }
  function hide() {
    clearTimeout(tapTimer.current);
    clearTimeout(hideTimer.current);
    lastTap.current = 0;
    setControls(false);
  }
  function showControls() {
    setControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 4000);
  }
  function seek(seconds: number) {
    if (durationRef.current <= 0) return;
    const at = clamp(seconds, 0, Math.max(0, durationRef.current - 0.2));
    player.current?.seek(at / durationRef.current);
    pendingSeek.current = { position: at, until: Date.now() + 2500 };
    positionRef.current = at;
    setPosition(at);
    report("Playing/Progress");
  }
  function pause(next: boolean) {
    pausedRef.current = next;
    setPaused(next);
    report("Playing/Progress");
  }
  const actions = useRef({ seek, hide, showControls, report, pause });
  actions.current = { seek, hide, showControls, report, pause };

  useEffect(() => {
    active.current = true;
    void Orientation.unlockAsync().catch(() => {});
    const state = AppState.addEventListener("change", (value) => {
      if (value !== "active") actions.current.pause(true);
    });
    const timer = setInterval(
      () => actions.current.report("Playing/Progress"),
      10000,
    );
    return () => {
      actions.current.report("Playing/Stopped");
      if (playbackRef.current) api.stopTranscode(playbackRef.current);
      active.current = false;
      subtitleRequest.current++;
      clearTimeout(tapTimer.current);
      clearTimeout(hideTimer.current);
      clearInterval(timer);
      state.remove();
      void Orientation.lockAsync(Orientation.OrientationLock.PORTRAIT_UP).catch(
        () => {},
      );
      for (const path of cachedSubtitles.current)
        void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => {});
    };
  }, [api, item.Id]);

  useEffect(() => {
    const abort = new AbortController();
    setLoading(true);
    setError("");
    setPlayback(undefined);
    setAudioTracks([]);
    setTextTracks([]);
    setAudioTrack(undefined);
    setTextTrack(undefined);
    setSubtitleUri("");
    if (playbackRef.current) {
      report("Playing/Stopped");
      api.stopTranscode(playbackRef.current);
    }
    playbackRef.current = undefined;
    started.current = false;
    resumed.current = false;
    void (async () => {
      try {
        initialPosition.current = positionLoaded.current
          ? positionRef.current
          : await readPosition(
              api.session,
              item.Id,
              (item.UserData?.PlaybackPositionTicks || 0) / 1e7,
            );
        positionLoaded.current = true;
        const p = await api.playback(
          item.Id,
          prefs.bitrate,
          force,
          abort.signal,
        );
        if (abort.signal.aborted) {
          api.stopTranscode(p);
          return;
        }
        playbackRef.current = p;
        setPlayback(p);
      } catch (e) {
        if (!abort.signal.aborted) {
          setError(e instanceof Error ? e.message : "播放源加载失败");
          setLoading(false);
        }
      }
    })();
    return () => abort.abort();
  }, [api, item.Id, force, attempt, prefs.bitrate]);

  // iOS VLCKit emits milliseconds (verified against the installed native bridge).
  function updateDuration(milliseconds: number) {
    if (milliseconds > 0) {
      durationRef.current = milliseconds / 1000;
      setDuration(milliseconds / 1000);
    }
  }
  function onPlaying(milliseconds: number, seekable: boolean) {
    updateDuration(milliseconds);
    setLoading(false);
    if (!resumed.current && seekable && durationRef.current > 0) {
      resumed.current = true;
      if (
        initialPosition.current > 0 &&
        initialPosition.current < durationRef.current - 2
      )
        seek(initialPosition.current);
    }
    if (!started.current) {
      started.current = true;
      report("Playing");
    }
  }
  function playbackFailed() {
    if (!forceRef.current) {
      setForce(true);
      return;
    }
    setLoading(false);
    setError(
      "原片播放和兼容转码均未成功。请检查 Jellyfin 的转码权限、网络和服务器日志。",
    );
  }
  const source = useMemo<VLCPlayerSource | undefined>(
    () =>
      playback
        ? {
            uri: playback.url,
            initType: 2,
            initOptions: [
              `--network-caching=${prefs.networkCacheMs}`,
              "--file-caching=500",
              "--avcodec-hw=any",
              "--no-video-title-show",
              "--no-osd",
              "--http-reconnect",
              "--quiet",
            ],
          }
        : undefined,
    [playback, prefs.networkCacheMs],
  );

  const gesture = useMemo(() => {
    let origin = 0;
    let moved = false;
    let target = 0;
    let ignored = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        origin = positionRef.current;
        target = origin;
        moved = false;
        ignored = false;
      },
      onPanResponderMove: (_, g) => {
        if (ignored) return;
        if (!moved && Math.abs(g.dy) > 12 && Math.abs(g.dy) > Math.abs(g.dx)) {
          ignored = true;
          clearTimeout(tapTimer.current);
          lastTap.current = 0;
          return;
        }
        if (Math.abs(g.dx) < 8 && !moved) return;
        if (!moved) {
          moved = true;
          dragging.current = true;
          actions.current.hide();
        }
        target = swipeTarget(
          origin,
          g.dx,
          width,
          durationRef.current,
          prefs.swipeSeconds,
        );
        setDragPosition(target);
      },
      onPanResponderRelease: (event, g) => {
        if (moved) {
          actions.current.seek(target);
          dragging.current = false;
          setDragPosition(undefined);
          return;
        }
        if (ignored || Math.abs(g.dy) > 12) return;
        const now = Date.now();
        if (lastTap.current && now - lastTap.current < 280) {
          clearTimeout(tapTimer.current);
          lastTap.current = 0;
          actions.current.hide();
          actions.current.seek(
            positionRef.current +
              (event.nativeEvent.locationX < width / 2 ? -1 : 1) *
                prefs.doubleTapSeconds,
          );
        } else {
          lastTap.current = now;
          clearTimeout(tapTimer.current);
          tapTimer.current = setTimeout(() => {
            lastTap.current = 0;
            setControls((visible) => !visible);
            clearTimeout(hideTimer.current);
            hideTimer.current = setTimeout(() => setControls(false), 4000);
          }, 280);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        dragging.current = false;
        setDragPosition(undefined);
        clearTimeout(tapTimer.current);
        lastTap.current = 0;
      },
    });
  }, [width, prefs.swipeSeconds, prefs.doubleTapSeconds]);
  const barWidth =
    width - Math.max(20, insets.left) - Math.max(20, insets.right);
  const barGesture = useMemo(() => {
    let target = 0;
    const update = (x: number) => {
      target = clamp(x / Math.max(1, barWidth), 0, 1) * durationRef.current;
      setDragPosition(target);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        dragging.current = true;
        actions.current.hide();
        update(e.nativeEvent.locationX);
      },
      onPanResponderMove: (e) => update(e.nativeEvent.locationX),
      onPanResponderRelease: () => {
        actions.current.seek(target);
        dragging.current = false;
        setDragPosition(undefined);
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => {
        dragging.current = false;
        setDragPosition(undefined);
      },
    });
  }, [barWidth]);

  async function externalSubtitle(index: number) {
    const p = playbackRef.current;
    if (!p) return;
    const generation = ++subtitleRequest.current;
    setTrackError("");
    const path = `${FileSystem.cacheDirectory}still-sub-${Date.now()}-${index}.vtt`;
    cachedSubtitles.current.push(path);
    try {
      const result = await FileSystem.downloadAsync(
        api.subtitle(item.Id, p.source.Id, index),
        path,
      );
      if (result.status !== 200) throw new Error();
      if (active.current && generation === subtitleRequest.current) {
        setTextTrack(undefined);
        setSubtitleUri(result.uri);
      }
    } catch {
      if (active.current && generation === subtitleRequest.current)
        setTrackError("外挂字幕加载失败，可以选择内嵌字幕或关闭字幕。");
    }
  }
  const displayed = dragPosition ?? position;
  return (
    <View style={s.root}>
      <StatusBar hidden />
      {source && (
        <VLCPlayer
          key={`${playback?.playSessionId}-${attempt}`}
          ref={player}
          style={StyleSheet.absoluteFill}
          source={source}
          autoplay={!paused}
          paused={paused}
          rate={rate}
          resizeMode="contain"
          autoAspectRatio
          playInBackground={false}
          audioTrack={audioTrack}
          textTrack={textTrack}
          subtitleUri={subtitleUri || undefined}
          acceptInvalidCertificates={false}
          onPlaying={(e) => onPlaying(e.duration, e.seekable)}
          onLoad={(e) => {
            updateDuration(e.duration);
            setAudioTracks(e.audioTracks || []);
            setTextTracks(e.textTracks || []);
          }}
          onProgress={(e) => {
            updateDuration(e.duration);
            if (
              !resumed.current &&
              e.currentTime > 0 &&
              durationRef.current > 0
            ) {
              resumed.current = true;
              if (
                initialPosition.current > 0 &&
                initialPosition.current < durationRef.current - 2
              ) {
                seek(initialPosition.current);
                return;
              }
            }
            if (dragging.current) return;
            const at = e.currentTime / 1000;
            const pending = pendingSeek.current;
            if (
              pending &&
              Date.now() < pending.until &&
              Math.abs(at - pending.position) > 3
            )
              return;
            pendingSeek.current = undefined;
            positionRef.current = at;
            setPosition(at);
          }}
          onPaused={() => {
            if (!pausedRef.current) pause(true);
          }}
          onError={playbackFailed}
          onEnd={() => {
            positionRef.current = durationRef.current;
            setPosition(durationRef.current);
            pause(true);
            showControls();
            report("Playing/Stopped");
            started.current = false;
          }}
        />
      )}
      <View
        style={StyleSheet.absoluteFill}
        {...gesture.panHandlers}
        accessibilityLabel="播放画面，左右滑动调整进度，单击显示控件"
      />
      {loading && !error && (
        <View pointerEvents="none" style={s.loading}>
          <ActivityIndicator color={colors.accent} />
          <Text style={s.loadingText}>
            {force ? "正在尝试 Jellyfin 兼容转码" : "正在打开视频"}
          </Text>
        </View>
      )}
      {(controls || !!error) && (
        <View
          pointerEvents="box-none"
          style={[
            s.top,
            {
              paddingTop: insets.top + 8,
              paddingLeft: Math.max(16, insets.left),
              paddingRight: Math.max(16, insets.right),
            },
          ]}
        >
          <IconButton
            name="chevron-back"
            label="返回媒体库"
            onPress={onClose}
          />
          <View style={{ flex: 1, marginHorizontal: 8 }}>
            <Text numberOfLines={1} style={s.title}>
              {item.Name}
            </Text>
            <Text style={s.meta}>
              {playback?.method === "DirectPlay"
                ? "原片直放 · VLC"
                : playback?.method === "DirectStream"
                  ? "Jellyfin 重封装 · VLC"
                  : "Jellyfin 转码 · VLC"}
            </Text>
          </View>
          <IconButton
            name="ellipsis-horizontal"
            label="音轨和播放设置"
            onPress={() => {
              setSheet(true);
              clearTimeout(hideTimer.current);
            }}
          />
        </View>
      )}
      {controls && !error && (
        <View
          style={[
            s.controls,
            {
              bottom: Math.max(30, insets.bottom) + 24,
              left: Math.max(20, insets.left),
              right: Math.max(20, insets.right),
            },
          ]}
        >
          <IconButton
            name={paused ? "play" : "pause"}
            label={paused ? "播放" : "暂停"}
            onPress={() => {
              if (paused && positionRef.current >= durationRef.current - 0.5)
                seek(0);
              pause(!paused);
              showControls();
            }}
          />
          <Text style={s.time}>
            {formatTime(displayed)}{" "}
            <Text style={{ color: "#9aaba5" }}>/ {formatTime(duration)}</Text>
          </Text>
          <View style={{ flex: 1 }} />
          {syncError && <Text style={s.sync}>进度待同步</Text>}
          <IconButton
            name="phone-landscape-outline"
            label="切换横竖屏"
            onPress={() => {
              void Orientation.lockAsync(
                width > height
                  ? Orientation.OrientationLock.PORTRAIT_UP
                  : Orientation.OrientationLock.LANDSCAPE,
              ).catch(() => {});
            }}
          />
        </View>
      )}
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="播放进度"
        accessibilityValue={{
          min: 0,
          max: Math.round(duration),
          now: Math.round(displayed),
        }}
        accessibilityActions={[
          { name: "increment", label: "快进" },
          { name: "decrement", label: "后退" },
        ]}
        onAccessibilityAction={(e) =>
          seek(
            positionRef.current +
              (e.nativeEvent.actionName === "increment" ? 1 : -1) *
                prefs.doubleTapSeconds,
          )
        }
        style={[
          s.barTouch,
          {
            bottom: Math.max(4, insets.bottom - 8),
            left: Math.max(20, insets.left),
            right: Math.max(20, insets.right),
          },
        ]}
        {...barGesture.panHandlers}
      >
        <View pointerEvents="none" style={s.bar}>
          <View
            style={{
              height: 2,
              width: `${clamp((displayed / Math.max(1, duration)) * 100, 0, 100)}%`,
              backgroundColor: colors.accent,
            }}
          />
        </View>
      </View>
      {!!error && (
        <View style={s.error}>
          <ErrorNote text={error} />
          <Button
            onPress={() => {
              setAttempt((n) => n + 1);
              pause(false);
            }}
          >
            重试播放
          </Button>
          <Button secondary onPress={onClose}>
            返回媒体库
          </Button>
        </View>
      )}
      {sheet && (
        <View style={s.sheetBackdrop}>
          <Pressable
            accessibilityLabel="关闭播放设置"
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setSheet(false);
              hide();
            }}
          />
          <View
            style={[
              s.sheet,
              {
                maxHeight: height - insets.top - 24,
                paddingBottom: Math.max(20, insets.bottom),
              },
            ]}
          >
            <View style={[ui.row, { justifyContent: "space-between" }]}>
              <Text style={s.sheetTitle}>播放设置</Text>
              <IconButton
                name="close"
                label="关闭播放设置"
                onPress={() => {
                  setSheet(false);
                  hide();
                }}
              />
            </View>
            <ScrollView>
              <Text style={s.groupTitle}>播放速度</Text>
              <View style={[ui.row, { gap: 8, flexWrap: "wrap" }]}>
                {[0.75, 1, 1.25, 1.5, 2].map((n) => (
                  <Pressable
                    key={n}
                    onPress={() => setRate(n)}
                    style={[s.option, rate === n && s.selected]}
                  >
                    <Text
                      style={{ color: rate === n ? colors.black : colors.text }}
                    >
                      {n}×
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.groupTitle}>音轨</Text>
              {audioTracks.length ? (
                audioTracks.map((t) => (
                  <Pressable
                    key={t.id}
                    onPress={() => setAudioTrack(t.id)}
                    style={s.track}
                  >
                    <Text
                      style={{
                        color:
                          audioTrack === t.id ? colors.accent : colors.text,
                      }}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                ))
              ) : (
                <Text style={ui.subtitle}>播放后显示可用音轨</Text>
              )}
              <Text style={s.groupTitle}>字幕</Text>
              <Pressable
                style={s.track}
                onPress={() => {
                  subtitleRequest.current++;
                  setTextTrack(-1);
                  setSubtitleUri("");
                }}
              >
                <Text
                  style={{
                    color: textTrack === -1 ? colors.accent : colors.text,
                  }}
                >
                  关闭字幕
                </Text>
              </Pressable>
              {textTracks
                .filter((t) => t.id !== -1)
                .map((t) => (
                  <Pressable
                    style={s.track}
                    key={t.id}
                    onPress={() => {
                      subtitleRequest.current++;
                      setSubtitleUri("");
                      setTextTrack(t.id);
                    }}
                  >
                    <Text
                      style={{
                        color: textTrack === t.id ? colors.accent : colors.text,
                      }}
                    >
                      {t.name}
                    </Text>
                  </Pressable>
                ))}
              {playback?.source.MediaStreams?.filter(
                (t) => t.Type === "Subtitle" && t.IsExternal,
              ).map((t) => (
                <Pressable
                  key={`external-${t.Index}`}
                  style={s.track}
                  onPress={() => void externalSubtitle(t.Index)}
                >
                  <Text style={ui.text}>
                    外挂 · {t.DisplayTitle || t.Language || t.Codec}
                  </Text>
                </Pressable>
              ))}
              {!!trackError && <ErrorNote text={trackError} />}
              <Text style={s.groupTitle}>播放模式</Text>
              <Text style={[ui.subtitle, { marginBottom: 12 }]}>
                原片无法正常解码或带宽不足时，可切换兼容转码。音轨与字幕会重新载入。
              </Text>
              <Button
                secondary
                onPress={() => {
                  setForce((f) => !f);
                  setSheet(false);
                  hide();
                }}
              >
                {force ? "重新尝试原片播放" : "使用 Jellyfin 兼容转码"}
              </Button>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
  loading: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
    alignItems: "center",
    gap: 12,
  },
  loadingText: { color: "#a9b8af", fontSize: 12 },
  top: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00000099",
  },
  title: { color: colors.text, fontSize: 15, fontWeight: "600" },
  meta: { color: "#acbbb1", fontSize: 10, marginTop: 5 },
  controls: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#00000099",
    borderRadius: 18,
    padding: 4,
  },
  time: { color: colors.text, fontSize: 12, fontVariant: ["tabular-nums"] },
  sync: { color: colors.error, fontSize: 10 },
  barTouch: { position: "absolute", height: 28, justifyContent: "center" },
  bar: { height: 2, backgroundColor: "#ffffff33", overflow: "hidden" },
  error: {
    position: "absolute",
    top: "28%",
    left: 28,
    right: 28,
    gap: 12,
    maxWidth: 540,
    alignSelf: "center",
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#00000070",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxWidth: 640,
    width: "100%",
    alignSelf: "center",
  },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: "600" },
  groupTitle: {
    color: colors.muted,
    fontSize: 12,
    marginTop: 22,
    marginBottom: 12,
  },
  option: { padding: 13, backgroundColor: colors.lifted, borderRadius: 12 },
  selected: { backgroundColor: colors.accent },
  track: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
});
