import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deviceProfile,
  Jellyfin,
  normalizeServer,
  request,
  serverUrl,
} from "./jellyfin";
const session = {
  server: "https://media.example/jellyfin",
  deviceId: "device-test",
  userId: "user-test",
  token: "test-token",
  userName: "me",
  serverName: "test",
};
afterEach(() => vi.unstubAllGlobals());
function reply(data: unknown) {
  const fetch = vi
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify(data), { status: 200 }),
    );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
describe("server routes and security", () => {
  it("preserves reverse proxy paths without doubling them", () => {
    expect(normalizeServer(" https://media.example/jellyfin/ ")).toBe(
      session.server,
    );
    expect(serverUrl(session.server, "/Videos/abc/master.m3u8?x=1").href).toBe(
      "https://media.example/jellyfin/Videos/abc/master.m3u8?x=1",
    );
    expect(serverUrl(session.server, "/jellyfin/Videos/abc").pathname).toBe(
      "/jellyfin/Videos/abc",
    );
  });
  it("rejects credentials in server input and cross-origin playback URLs", () => {
    expect(() =>
      normalizeServer("https://user:secret@media.example"),
    ).toThrow();
    expect(() => normalizeServer("ftp://media.example")).toThrow();
    expect(() =>
      serverUrl(session.server, "https://other.example/video"),
    ).toThrow();
  });
  it("uses headers for authenticated API requests", async () => {
    const fetch = reply({ Items: [] });
    await new Jellyfin(session).views();
    expect(String(fetch.mock.calls[0][0])).not.toContain(session.token);
    expect(fetch.mock.calls[0][1].headers.Authorization).toContain(
      'Token="test-token"',
    );
  });
  it("returns useful expired-login errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("", { status: 401 })),
    );
    await expect(
      request(session.server, session.deviceId, "/Users", session.token),
    ).rejects.toThrow("登录已过期");
  });
});
describe("native playback negotiation", () => {
  it("advertises native MKV, HEVC and DTS support", () => {
    const profile = deviceProfile(120e6);
    expect(profile.DirectPlayProfiles[0].Container).toContain("mkv");
    expect(profile.DirectPlayProfiles[0].AudioCodec).toContain("dts");
    expect(deviceProfile(8e6, true).DirectPlayProfiles).toEqual([]);
  });
  it("plays native files with static range requests and session identity", async () => {
    const fetch = reply({
      PlaySessionId: "play-1",
      MediaSources: [
        { Id: "source-1", Container: "mkv", SupportsDirectPlay: true },
      ],
    });
    const result = await new Jellyfin(session).playback("movie", 120e6, false);
    const url = new URL(result.url);
    expect(url.pathname).toBe("/jellyfin/Videos/movie/stream.mkv");
    expect(url.searchParams.get("Static")).toBe("true");
    expect(result.method).toBe("DirectPlay");
    expect(JSON.parse(fetch.mock.calls[0][1].body).StartTimeTicks).toBe(0);
  });
  it("uses the negotiated HLS URL, preserves its encoding parameters, forces compatibility", async () => {
    const fetch = reply({
      PlaySessionId: "play-2",
      MediaSources: [
        {
          Id: "s",
          SupportsTranscoding: true,
          TranscodingUrl:
            "/jellyfin/Videos/movie/master.m3u8?VideoCodec=h264&AudioCodec=aac",
        },
      ],
    });
    const result = await new Jellyfin(session).playback("movie", 8e6, true);
    expect(result.method).toBe("Transcode");
    expect(result.isHls).toBe(true);
    expect(new URL(result.url).searchParams.get("VideoCodec")).toBe("h264");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.EnableDirectPlay).toBe(false);
    expect(body.AllowVideoStreamCopy).toBe(false);
  });
  it("does not use a direct-only source when transcode was requested", async () => {
    reply({ MediaSources: [{ Id: "s", SupportsDirectPlay: true }] });
    await expect(
      new Jellyfin(session).playback("movie", 8e6, true),
    ).rejects.toThrow("没有可用播放源");
  });
  it("reports tick positions to the correct session and releases transcodes", async () => {
    const fetch = reply({});
    const api = new Jellyfin(session);
    const p = {
      url: "",
      method: "Transcode" as const,
      playSessionId: "play-1",
      source: { Id: "s" },
      isHls: true,
    };
    await api.report("Playing/Stopped", "movie", p, 12.5, true);
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
      PositionTicks: 125000000,
      PlaySessionId: "play-1",
      IsPaused: true,
    });
    api.stopTranscode(p);
    expect(fetch.mock.calls[1][1].method).toBe("DELETE");
    expect(String(fetch.mock.calls[1][0])).toContain("PlaySessionId=play-1");
  });
  it("keeps folder traversal nonrecursive and search recursive", async () => {
    const fetch = reply({ Items: [], TotalRecordCount: 0 });
    const api = new Jellyfin(session);
    await api.items("folder", 100);
    expect(new URL(fetch.mock.calls[0][0]).searchParams.get("Recursive")).toBe(
      "false",
    );
    await api.items("folder", 0, "movie");
    expect(new URL(fetch.mock.calls[1][0]).searchParams.get("Recursive")).toBe(
      "true",
    );
  });
});
