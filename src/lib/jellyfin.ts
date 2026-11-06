import type { MediaItem, MediaSource, Playback, Session } from "../types";

export function normalizeServer(input: string) {
  const url = new URL(input.trim());
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "请输入完整的 http:// 或 https:// 服务器地址，不含账号和查询参数。",
    );
  return url.toString().replace(/\/+$/, "");
}
export function serverUrl(server: string, path: string) {
  const base = new URL(server + "/");
  if (/^https?:\/\//i.test(path)) {
    const absolute = new URL(path);
    if (absolute.origin !== base.origin)
      throw new Error("服务器返回了其他域名的媒体地址，已拒绝传递登录凭据。");
    return absolute;
  }
  const prefix = base.pathname.replace(/\/$/, "");
  return new URL(
    path.startsWith(prefix + "/") && prefix
      ? path
      : prefix + "/" + path.replace(/^\//, ""),
    base.origin,
  );
}
export function authHeader(deviceId: string, token?: string) {
  return `MediaBrowser Client="Still", Device="Personal Player", DeviceId="${deviceId}", Version="0.1.0"${token ? `, Token="${token}"` : ""}`;
}
export async function request<T>(
  server: string,
  deviceId: string,
  path: string,
  token?: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const timeout = setTimeout(abort, 20000);
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) controller.abort();
  let response: Response;
  try {
    response = await fetch(serverUrl(server, path), {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: authHeader(deviceId, token),
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error(
      "无法连接服务器。请检查地址、网络、HTTPS 证书及 iPhone 的本地网络权限。",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
  if (!response.ok)
    throw new Error(
      response.status === 401
        ? "账号或密码错误，或登录已过期，请重新连接。"
        : response.status === 403
          ? "当前账号没有访问或转码权限。"
          : `Jellyfin 请求失败（${response.status}）。请检查服务器状态。`,
    );
  if (response.status === 204 || response.headers.get("content-length") === "0")
    return undefined as T;
  return response.json();
}
export async function login(
  serverInput: string,
  username: string,
  password: string,
  deviceId: string,
): Promise<Session> {
  const server = normalizeServer(serverInput);
  const data = await request<{
    AccessToken: string;
    User: { Id: string; Name: string };
    ServerId: string;
  }>(server, deviceId, "/Users/AuthenticateByName", undefined, {
    Username: username,
    Pw: password,
  });
  return {
    server,
    deviceId,
    token: data.AccessToken,
    userId: data.User.Id,
    userName: data.User.Name,
    serverName: new URL(server).host,
  };
}
export function deviceProfile(maxBitrate: number, force = false) {
  return {
    Name: "Still iOS VLC",
    MaxStreamingBitrate: maxBitrate,
    MaxStaticBitrate: maxBitrate,
    DirectPlayProfiles: force
      ? []
      : [
          {
            Container:
              "mp4,m4v,mov,mkv,avi,ts,m2ts,webm,wmv,asf,flv,ogv,mpg,mpeg,vob",
            Type: "Video",
            VideoCodec:
              "h264,hevc,mpeg4,mpeg2video,mpeg1video,vp8,vp9,av1,vc1,wmv3,theora,mjpeg",
            AudioCodec:
              "aac,mp3,ac3,eac3,dts,flac,alac,opus,vorbis,pcm_s16le,pcm_s24le,truehd",
          },
        ],
    TranscodingProfiles: [
      {
        Container: "ts",
        Type: "Video",
        VideoCodec: "h264",
        AudioCodec: "aac",
        Protocol: "hls",
        Context: "Streaming",
        MaxAudioChannels: "2",
        MinSegments: 2,
        SegmentLength: 4,
        BreakOnNonKeyFrames: false,
      },
    ],
    SubtitleProfiles: [
      "srt",
      "ass",
      "ssa",
      "sub",
      "pgssub",
      "dvdsub",
      "vtt",
      "mov_text",
    ].map((Format) => ({ Format, Method: "Embed" })),
  };
}
export class Jellyfin {
  constructor(public session: Session) {}
  get<T>(path: string, signal?: AbortSignal) {
    const s = this.session;
    return request<T>(s.server, s.deviceId, path, s.token, undefined, signal);
  }
  post<T>(path: string, body: unknown, signal?: AbortSignal) {
    const s = this.session;
    return request<T>(s.server, s.deviceId, path, s.token, body, signal);
  }
  async views(signal?: AbortSignal) {
    return (
      await this.get<{ Items: MediaItem[] }>(
        `/Users/${this.session.userId}/Views`,
        signal,
      )
    ).Items;
  }
  async items(parentId: string, start = 0, search = "", signal?: AbortSignal) {
    const q = new URLSearchParams({
      UserId: this.session.userId,
      ParentId: parentId,
      StartIndex: String(start),
      Limit: "100",
      Recursive: String(!!search),
      SortBy: "IsFolder,SortName",
      SortOrder: "Ascending",
      Fields: "Overview,ChildCount,MediaSources",
      EnableUserData: "true",
      ...(search
        ? {
            SearchTerm: search,
            IncludeItemTypes: "Movie,Episode,Video,Folder,Series,Season,BoxSet",
          }
        : {}),
    });
    return this.get<{ Items: MediaItem[]; TotalRecordCount: number }>(
      `/Items?${q}`,
      signal,
    );
  }
  async resume(signal?: AbortSignal) {
    return (
      await this.get<{ Items: MediaItem[] }>(
        `/Users/${this.session.userId}/Items/Resume?Limit=8&MediaTypes=Video&Fields=Overview,MediaSources`,
        signal,
      )
    ).Items;
  }
  async item(id: string) {
    return this.get<MediaItem>(
      `/Users/${this.session.userId}/Items/${encodeURIComponent(id)}`,
    );
  }
  image(item: MediaItem, kind = "Primary", width = 480) {
    const tag =
      kind === "Backdrop"
        ? item.BackdropImageTags?.[0]
        : item.ImageTags?.[kind];
    if (!tag) return undefined;
    const url = serverUrl(
      this.session.server,
      `/Items/${item.Id}/Images/${kind}${kind === "Backdrop" ? "/0" : ""}`,
    );
    url.search = new URLSearchParams({
      maxWidth: String(width),
      quality: "85",
      tag,
      api_key: this.session.token,
    }).toString();
    return url.toString();
  }
  async playback(
    itemId: string,
    bitrate: number,
    force: boolean,
    signal?: AbortSignal,
  ): Promise<Playback> {
    const data = await this.post<{
      MediaSources: MediaSource[];
      PlaySessionId: string;
      ErrorCode?: string;
    }>(
      `/Items/${itemId}/PlaybackInfo`,
      {
        UserId: this.session.userId,
        DeviceProfile: deviceProfile(bitrate, force),
        MaxStreamingBitrate: bitrate,
        StartTimeTicks: 0,
        IsPlayback: true,
        AutoOpenLiveStream: true,
        EnableDirectPlay: !force,
        EnableDirectStream: !force,
        EnableTranscoding: true,
        AllowVideoStreamCopy: !force,
        AllowAudioStreamCopy: !force,
      },
      signal,
    );
    const source = data.MediaSources?.find(
      (s) => (!force && s.SupportsDirectPlay) || s.TranscodingUrl,
    );
    if (!source)
      throw new Error(
        `没有可用播放源${data.ErrorCode ? `（${data.ErrorCode}）` : ""}。请检查 Jellyfin 转码权限与 FFmpeg 配置。`,
      );
    const direct = !force && source.SupportsDirectPlay;
    const url = direct
      ? serverUrl(
          this.session.server,
          `/Videos/${itemId}/stream.${source.Container || "mp4"}`,
        )
      : serverUrl(this.session.server, source.TranscodingUrl!);
    url.searchParams.set("api_key", this.session.token);
    url.searchParams.set("DeviceId", this.session.deviceId);
    url.searchParams.set("MediaSourceId", source.Id);
    url.searchParams.set("PlaySessionId", data.PlaySessionId);
    if (direct) url.searchParams.set("Static", "true");
    return {
      url: url.toString(),
      method: direct
        ? "DirectPlay"
        : source.SupportsDirectStream
          ? "DirectStream"
          : "Transcode",
      source,
      playSessionId: data.PlaySessionId,
      isHls: !direct,
    };
  }
  subtitle(itemId: string, sourceId: string, index: number) {
    const url = serverUrl(
      this.session.server,
      `/Videos/${itemId}/${sourceId}/Subtitles/${index}/Stream.vtt`,
    );
    url.searchParams.set("api_key", this.session.token);
    return url.toString();
  }
  report(
    event: "Playing" | "Playing/Progress" | "Playing/Stopped",
    itemId: string,
    playback: Playback,
    seconds: number,
    paused: boolean,
  ) {
    const s = this.session;
    return fetch(serverUrl(s.server, `/Sessions/${event}`), {
      method: "POST",
      headers: {
        Authorization: authHeader(s.deviceId, s.token),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ItemId: itemId,
        MediaSourceId: playback.source.Id,
        PlaySessionId: playback.playSessionId,
        PositionTicks: Math.round(seconds * 10000000),
        IsPaused: paused,
        CanSeek: true,
        PlayMethod: playback.method,
      }),
    }).then((r) => {
      if (!r.ok) throw new Error("观看进度同步失败");
    });
  }
  stopTranscode(playback: Playback) {
    if (!playback.isHls) return;
    const s = this.session;
    void fetch(
      serverUrl(
        s.server,
        `/Videos/ActiveEncodings?DeviceId=${encodeURIComponent(s.deviceId)}&PlaySessionId=${encodeURIComponent(playback.playSessionId)}`,
      ),
      {
        method: "DELETE",
        headers: { Authorization: authHeader(s.deviceId, s.token) },
      },
    ).catch(() => {});
  }
}
