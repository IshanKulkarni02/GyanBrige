// Network self-report for attendance.
// Returns local IP and (when allowed) BSSID/SSID so the server can verify
// the device is on a registered campus AP.

import { Platform } from 'react-native';

export interface NetworkSelfReport {
  ip?: string;
  ssid?: string;
  bssid?: string;
  platform: 'IOS' | 'ANDROID' | 'WEB' | 'DESKTOP';
}

export async function selfReportNetwork(): Promise<NetworkSelfReport> {
  if (Platform.OS === 'web') {
    return { platform: 'WEB', ip: await webGuessLocalIp() };
  }
  try {
    const Network = await import('expo-network');
    const ip = await Network.getIpAddressAsync();
    return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID', ip };
  } catch {
    return { platform: Platform.OS === 'ios' ? 'IOS' : 'ANDROID' };
  }
}

async function webGuessLocalIp(): Promise<string | undefined> {
  if (typeof RTCPeerConnection === 'undefined') return undefined;
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('');
    pc.createOffer().then((o) => pc.setLocalDescription(o));
    pc.onicecandidate = (ev) => {
      const cand = ev.candidate?.candidate ?? '';
      const m = cand.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (m) {
        pc.close();
        resolve(m[1]);
      }
    };
    setTimeout(() => {
      pc.close();
      resolve(undefined);
    }, 1500);
  });
}
