// Collaborative whiteboard via Socket.IO stroke relay.
// Web: canvas renders directly in React; strokes broadcast via wb:draw.
// Native: shows "open in browser" until a WebView-based canvas is added.

import { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, Platform, Pressable } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { tokenStore, realtimeUrl } from '../../../lib/api';
import { colors, radius, spacing, typography } from '../../../lib/theme';
import { Surface, Tag } from '../../../components/ui';

interface Stroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export default function Whiteboard() {
  const { boardId } = useLocalSearchParams<{ boardId: string }>();
  const [peers, setPeers] = useState(0);
  const [color, setColor] = useState('#0E0E10');
  const [lineWidth, setLineWidth] = useState(3);
  const c = colors.dark;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const socketRef = useRef<import('socket.io-client').Socket | null>(null);
  const drawing = useRef(false);
  const currentStroke = useRef<{ x: number; y: number }[]>([]);

  const drawStroke = useCallback((ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    if (stroke.points.length < 2) return;
    ctx.beginPath();
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.moveTo(stroke.points[0]!.x, stroke.points[0]!.y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i]!.x, stroke.points[i]!.y);
    }
    ctx.stroke();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !boardId) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    fit();
    window.addEventListener('resize', fit);

    let mounted = true;

    (async () => {
      const { io } = await import('socket.io-client');
      if (!mounted) return; // component unmounted before async resolved
      const token = await tokenStore.get();
      if (!mounted) return;
      const socket = io(realtimeUrl, { auth: { token }, transports: ['websocket'] });
      socketRef.current = socket;

      socket.emit('wb:join', boardId);
      socket.on('wb:peer-joined', () => setPeers((n) => n + 1));

      socket.on('wb:draw', (stroke: Stroke) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) drawStroke(ctx, stroke);
      });
    })();

    return () => {
      mounted = false;
      socketRef.current?.disconnect();
      socketRef.current = null;
      window.removeEventListener('resize', fit);
    };
  }, [boardId, drawStroke]);

  if (Platform.OS !== 'web') {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: spacing.lg, justifyContent: 'center' }}>
        <Surface>
          <Tag label="Whiteboard" tone="accent" />
          <Text style={{ color: c.text, ...typography.h2, marginTop: spacing.sm }}>
            Whiteboard works best on web + desktop.
          </Text>
          <Text style={{ color: c.textMuted, marginTop: spacing.sm }}>
            Open this lecture's whiteboard in your browser at the same URL to draw with full pen, shapes, and infinite canvas.
          </Text>
        </Surface>
      </View>
    );
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    const rect = canvasRef.current!.getBoundingClientRect();
    currentStroke.current = [{ x: e.clientX - rect.left, y: e.clientY - rect.top }];
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    currentStroke.current.push({ x, y });
    const ctx = canvas.getContext('2d')!;
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    if (!drawing.current || !boardId) return;
    drawing.current = false;
    if (currentStroke.current.length > 1 && socketRef.current) {
      socketRef.current.emit('wb:draw', {
        boardId,
        points: currentStroke.current,
        color,
        width: lineWidth,
      });
    }
    currentStroke.current = [];
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const COLORS = ['#0E0E10', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#ffffff'];
  const WIDTHS = [2, 4, 8, 16];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          padding: spacing.sm,
          borderBottomWidth: 1,
          borderBottomColor: c.border,
          flexWrap: 'wrap',
        }}
      >
        <Text style={{ color: c.textMuted, fontSize: 12 }}>{peers + 1} drawing</Text>
        {COLORS.map((col) => (
          <Pressable
            key={col}
            onPress={() => setColor(col)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: col,
              borderWidth: color === col ? 3 : 1,
              borderColor: color === col ? c.primary : c.border,
            }}
          />
        ))}
        {WIDTHS.map((w) => (
          <Pressable
            key={w}
            onPress={() => setLineWidth(w)}
            style={{
              width: 28,
              height: 28,
              borderRadius: radius.sm,
              borderWidth: lineWidth === w ? 2 : 1,
              borderColor: lineWidth === w ? c.primary : c.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: c.surface,
            }}
          >
            <View style={{ width: w, height: w, borderRadius: w, backgroundColor: c.text }} />
          </Pressable>
        ))}
        <Pressable
          onPress={clearCanvas}
          style={{
            paddingHorizontal: spacing.sm,
            paddingVertical: spacing.xs,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: c.border,
            backgroundColor: c.surface,
          }}
        >
          <Text style={{ color: c.text, fontSize: 12 }}>Clear</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {/* @ts-expect-error — canvas is web-only, not in RN types */}
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%', cursor: 'crosshair', touchAction: 'none', backgroundColor: '#fff' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </View>
    </View>
  );
}
