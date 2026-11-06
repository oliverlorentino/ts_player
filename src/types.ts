export interface Session {
  server: string;
  token: string;
  userId: string;
  userName: string;
  serverName: string;
  deviceId: string;
}
export interface MediaItem {
  Id: string;
  Name: string;
  Type?: string;
  IsFolder?: boolean;
  ChildCount?: number;
  ProductionYear?: number;
  Overview?: string;
  RunTimeTicks?: number;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  UserData?: {
    PlaybackPositionTicks?: number;
    PlayedPercentage?: number;
    Played?: boolean;
  };
  MediaSources?: MediaSource[];
  demoArt?: string;
}
export interface MediaStream {
  Index: number;
  Type: string;
  Codec?: string;
  Language?: string;
  DisplayTitle?: string;
  IsExternal?: boolean;
  DeliveryUrl?: string;
  DeliveryMethod?: string;
}
export interface MediaSource {
  Id: string;
  Container?: string;
  SupportsDirectPlay?: boolean;
  SupportsDirectStream?: boolean;
  SupportsTranscoding?: boolean;
  TranscodingUrl?: string;
  MediaStreams?: MediaStream[];
  DefaultAudioStreamIndex?: number;
  DefaultSubtitleStreamIndex?: number;
  RunTimeTicks?: number;
}
export interface Playback {
  url: string;
  method: "DirectPlay" | "DirectStream" | "Transcode";
  playSessionId: string;
  source: MediaSource;
  isHls: boolean;
}
export interface Preferences {
  bitrate: number;
  networkCacheMs: number;
  swipeSeconds: number;
  doubleTapSeconds: number;
  list: boolean;
}
export const defaults: Preferences = {
  bitrate: 120000000,
  networkCacheMs: 1500,
  swipeSeconds: 120,
  doubleTapSeconds: 10,
  list: false,
};
