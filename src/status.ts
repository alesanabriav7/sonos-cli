import type { HttpClient } from "./device.js";
import { defaultHttpClient } from "./device.js";
import { record, text, xmlParser } from "./xml.js";

const AUDIO_FORMATS: Record<string, string> = {
  "0": "No audio",
  "2": "Stereo PCM",
  "18": "Dolby Digital 2.0",
  "22": "Dolby Digital 5.1",
  "34": "Dolby Digital Plus 2.0",
  "38": "Dolby Digital Plus 5.1",
  "39": "Dolby Digital Plus 7.1",
  "40": "Dolby Digital Plus (Atmos)",
  "58": "DTS 5.1",
  "63": "Dolby Atmos (TrueHD/MAT)",
  "84934658": "Multichannel PCM 5.1",
  "84934662": "Multichannel PCM 7.1",
};

export async function getTvAudioStatus(
  host: string,
  client: HttpClient = defaultHttpClient,
): Promise<{ code: string; format: string; raw: Record<string, string> }> {
  const response = await client.fetch(`http://${host}:1400/status/zp`, {
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`Status failed: HTTP ${response.status}`);
  const parsed = record(xmlParser.parse(await response.text()));
  const supportInfo = record(
    parsed.ZPSupportInfo || parsed.ZonePlayerStatus || parsed,
  );
  const zonePlayer = record(supportInfo.ZPInfo || supportInfo);
  const raw = Object.fromEntries(
    Object.entries(zonePlayer)
      .filter(([, value]) => typeof value !== "object")
      .map(([key, value]) => [key, text(value)]),
  );
  const code = raw.HTAudioInCode ?? "unknown";
  return { code, format: AUDIO_FORMATS[code] ?? `Unknown (${code})`, raw };
}
