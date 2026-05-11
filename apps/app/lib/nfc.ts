// Unified NFC interface across platforms.
// Native mobile  -> react-native-nfc-manager
// Web (Android)  -> NDEFReader (Web NFC)
// Tauri desktop  -> invoke('read_nfc_once') from pcsc-lite reader
// Fallback       -> caller falls back to QR scan or manual entry.

import { isTauri, isNative } from './capabilities';

export interface NfcReadResult {
  source: 'mobile' | 'web' | 'desktop';
  payload: string;
}

export async function readNfcOnce(): Promise<NfcReadResult> {
  if (isTauri) {
    const { invoke } = await import('@tauri-apps/api/core').catch(() => ({ invoke: null as never }));
    if (!invoke) throw new Error('Tauri runtime missing');
    const uid = (await invoke('read_nfc_once', {})) as string;
    return { source: 'desktop', payload: uid };
  }

  if (isNative) {
    const NfcManager = (await import('react-native-nfc-manager')).default;
    const { NfcTech, Ndef } = await import('react-native-nfc-manager');
    await NfcManager.start();
    try {
      await NfcManager.requestTechnology(NfcTech.Ndef);
      const tag = await NfcManager.getTag();
      const text = tag?.ndefMessage?.[0]
        ? Ndef.text.decodePayload(new Uint8Array(tag.ndefMessage[0].payload))
        : (tag?.id ?? '');
      return { source: 'mobile', payload: text };
    } finally {
      await NfcManager.cancelTechnologyRequest().catch(() => undefined);
    }
  }

  if (typeof globalThis !== 'undefined' && 'NDEFReader' in globalThis) {
    const Reader = (globalThis as { NDEFReader: new () => EventTarget & { scan: () => Promise<void> } }).NDEFReader;
    const reader = new Reader();
    await reader.scan();
    return new Promise((resolve, reject) => {
      reader.addEventListener(
        'reading',
        (ev: Event) => {
          const e = ev as unknown as { serialNumber?: string; message?: { records: { data?: ArrayBuffer }[] } };
          const text =
            e.message?.records?.[0]?.data
              ? new TextDecoder().decode(e.message.records[0].data as ArrayBuffer)
              : (e.serialNumber ?? '');
          resolve({ source: 'web', payload: text });
        },
        { once: true } as AddEventListenerOptions,
      );
      setTimeout(() => reject(new Error('NFC scan timeout')), 30_000);
    });
  }

  throw new Error('NFC not available on this platform; use QR fallback.');
}
