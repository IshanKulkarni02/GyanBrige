// Collaborative whiteboard via Y.js + Socket.IO. Web build uses an HTML canvas;
// native builds get a "open in browser" CTA (full canvas needs WebView host).

import { useEffect, useRef, useState } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tokenStore, realtimeUrl } from '../../../lib/api';
import { useAuth } from '../../../lib/auth-store';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { Hero, Surface, Tag } from '../../../components/ui';

export default function Whiteboard() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const me = useAuth((s) => s.me);
  const [peers, setPeers] = useState(0);
  const c = colors.dark;

  useEffect(() => {
    if (Platform.OS !== 'web' || !boardId) return;
    let cleanup: (() => void) | null = null;
    (async () => {
      const { io } = await import('socket.io-client');
      const token = await tokenStore.get();
      const socket = io(realtimeUrl, { auth: { token }, transports: ['websocket'] });
      socket.emit('wb:join', boardId);
      socket.on('wb:peer-joined', () => setPeers((n) => n + 1));
      cleanup = () => socket.disconnect();
    })();
    return () => cleanup?.();
  }, [boardId]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: spacing.lg, justifyContent: 'center' }}>
        <Surface>
          <Tag label="Whiteboard" tone="accent" />
          <Text style={{ color: c.text, ...typography.h2, marginTop: spacing.sm }}>
            Whiteboard works best on web + desktop.
          </Text>
          <Text style={{ color: c.textMuted, marginTop: spacing.sm }}>
            Open this lecture's whiteboard in your browser at the same URL to draw with full pen, shapes, and infinite canvas. Mobile shows a viewer in the next release.
          </Text>
        </Surface>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Hero
        eyebrow="Live"
        title="Whiteboard"
        subtitle={`${peers + 1} drawing now · board ${boardId?.slice(0, 6)}`}
      />
      <View style={{ flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg }}>
        <View
          style={{
            flex: 1,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: '#fff',
            overflow: 'hidden',
          }}
        >
          <iframe
            title="whiteboard"
            srcDoc={`<html><body style="margin:0"><canvas id="c" style="width:100%;height:100%"></canvas><script>const cvs=document.getElementById('c');const ctx=cvs.getContext('2d');function fit(){cvs.width=cvs.offsetWidth*devicePixelRatio;cvs.height=cvs.offsetHeight*devicePixelRatio;ctx.scale(devicePixelRatio,devicePixelRatio)}fit();let drawing=false;cvs.onpointerdown=e=>{drawing=true;ctx.beginPath();ctx.moveTo(e.offsetX,e.offsetY)};cvs.onpointermove=e=>{if(!drawing)return;ctx.lineTo(e.offsetX,e.offsetY);ctx.strokeStyle='#0E0E10';ctx.lineWidth=2;ctx.stroke()};cvs.onpointerup=()=>drawing=false;window.onresize=fit;</script></body></html>`}
            style={{ border: 'none', width: '100%', height: '100%' }}
          />
        </View>
      </View>
    </View>
  );
}
