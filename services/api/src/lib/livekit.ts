import { AccessToken, EgressClient, RoomServiceClient, EncodedFileType } from 'livekit-server-sdk';
import { env } from '../env.js';

const httpUrl = env.LIVEKIT_URL.replace(/^ws/, 'http');

export const livekitRoomService = new RoomServiceClient(
  httpUrl,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export const livekitEgress = new EgressClient(
  httpUrl,
  env.LIVEKIT_API_KEY,
  env.LIVEKIT_API_SECRET,
);

export interface TokenInput {
  identity: string;
  name: string;
  room: string;
  canPublish: boolean;
  canSubscribe?: boolean;
  metadata?: string;
  ttlSeconds?: number;
}

export async function mintAccessToken(input: TokenInput): Promise<string> {
  const at = new AccessToken(env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET, {
    identity: input.identity,
    name: input.name,
    metadata: input.metadata,
    ttl: input.ttlSeconds ?? 6 * 3600,
  });
  at.addGrant({
    room: input.room,
    roomJoin: true,
    canPublish: input.canPublish,
    canPublishData: true,
    canSubscribe: input.canSubscribe ?? true,
  });
  return at.toJwt();
}

export async function ensureRoom(roomName: string, emptyTimeoutSec = 600): Promise<void> {
  try {
    await livekitRoomService.createRoom({ name: roomName, emptyTimeout: emptyTimeoutSec });
  } catch (err) {
    const code = (err as { status?: number }).status;
    if (code !== 409) throw err;
  }
}

export async function startRecording(opts: {
  roomName: string;
  lectureId: string;
  language?: string;
  notesType?: string;
}): Promise<{ egressId: string; filepath: string }> {
  const filepath = `recordings/${opts.lectureId}-${Date.now()}.mp4`;
  const userMetadata = JSON.stringify({
    lectureId: opts.lectureId,
    language: opts.language ?? 'mixed',
    notesType: opts.notesType ?? 'full',
  });
  const egress = await livekitEgress.startRoomCompositeEgress(
    opts.roomName,
    {
      file: {
        fileType: EncodedFileType.MP4,
        filepath,
      },
    },
    { layout: 'speaker', audioOnly: false, userMetadata },
  );
  return { egressId: egress.egressId, filepath };
}

export async function stopRecording(egressId: string): Promise<void> {
  try {
    await livekitEgress.stopEgress(egressId);
  } catch (err) {
    if ((err as { status?: number }).status !== 404) throw err;
  }
}
