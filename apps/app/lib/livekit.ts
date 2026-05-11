// Thin LiveKit helper. Web + Tauri use livekit-client; native iOS/Android use
// @livekit/react-native via the LectureLive screen directly.

import { api } from './api';

export interface JoinTokenResponse {
  token: string;
  room: string;
  livekitUrl: string;
}

export async function fetchJoinToken(lectureId: string): Promise<JoinTokenResponse> {
  return api<JoinTokenResponse>('/api/livestreams/token', {
    method: 'POST',
    body: JSON.stringify({ lectureId }),
  });
}

export async function startLiveRoom(lectureId: string): Promise<{
  roomName: string;
  sessionId: string;
  livekitUrl: string;
}> {
  return api('/api/livestreams/rooms', {
    method: 'POST',
    body: JSON.stringify({ lectureId }),
  });
}

export async function startRecording(lectureId: string, language?: string): Promise<{ egressId: string }> {
  return api('/api/livestreams/start-recording', {
    method: 'POST',
    body: JSON.stringify({ lectureId, language }),
  });
}

export async function stopRecording(lectureId: string): Promise<{ ok: boolean }> {
  return api('/api/livestreams/stop-recording', {
    method: 'POST',
    body: JSON.stringify({ lectureId }),
  });
}
