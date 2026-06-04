import { NextRequest, NextResponse } from 'next/server';
import { mkdir, writeFile, readFile, unlink, stat, readdir } from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';

export const maxDuration = 3600;

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
const TEMP_DIR    = path.join(process.cwd(), 'tmp', 'uploads');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    const chunkIndex  = formData.get('chunkIndex');
    const totalChunks = formData.get('totalChunks');
    const uploadId    = formData.get('uploadId');

    if (chunkIndex !== null && totalChunks !== null && uploadId) {
      return handleChunk(formData);
    }

    // ── Single small-file upload ─────────────────────────────────────────────
    const file = formData.get('file') as File;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    await mkdir(UPLOADS_DIR, { recursive: true });

    const ext      = file.name.split('.').pop() ?? 'mp4';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);

    await writeFile(filepath, Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({ success: true, url: `/uploads/${filename}`, filename, size: file.size });
  } catch (err) {
    console.error('Upload error:', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

/**
 * Parallel-safe chunked upload handler.
 *
 * Each chunk is written to its own temp file:
 *   tmp/uploads/{uploadId}-{chunkIndex}.part
 *
 * This lets the client send multiple chunks in parallel without
 * worrying about write order. When all parts are present, they
 * are assembled in index order and the temp files are cleaned up.
 */
async function handleChunk(formData: FormData) {
  const chunk       = formData.get('chunk') as File;
  const chunkIndex  = parseInt(formData.get('chunkIndex') as string, 10);
  const totalChunks = parseInt(formData.get('totalChunks') as string, 10);
  const uploadId    = formData.get('uploadId') as string;
  const originalName = (formData.get('originalName') as string) || 'upload.mp4';

  if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
    return NextResponse.json({ error: 'Invalid chunk data' }, { status: 400 });
  }

  await mkdir(TEMP_DIR,    { recursive: true });
  await mkdir(UPLOADS_DIR, { recursive: true });

  // Write this chunk to its own file
  const partPath = path.join(TEMP_DIR, `${uploadId}-${chunkIndex}.part`);
  await writeFile(partPath, Buffer.from(await chunk.arrayBuffer()));

  // Count how many parts we have now
  const allFiles  = await readdir(TEMP_DIR);
  const partsHere = allFiles.filter(f => f.startsWith(`${uploadId}-`) && f.endsWith('.part')).length;

  if (partsHere < totalChunks) {
    // Not all chunks received yet — just acknowledge
    return NextResponse.json({ success: true, complete: false, chunkIndex, received: partsHere, total: totalChunks });
  }

  // ── All chunks present — assemble in order ───────────────────────────────
  const ext      = originalName.split('.').pop() ?? 'mp4';
  const filename = `${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`;
  const finalPath = path.join(UPLOADS_DIR, filename);

  const writer = createWriteStream(finalPath);
  await new Promise<void>((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);

    (async () => {
      for (let i = 0; i < totalChunks; i++) {
        const p = path.join(TEMP_DIR, `${uploadId}-${i}.part`);
        const buf = await readFile(p);
        writer.write(buf);
      }
      writer.end();
    })().catch(reject);
  });

  // Clean up all part files
  await Promise.all(
    Array.from({ length: totalChunks }, (_, i) =>
      unlink(path.join(TEMP_DIR, `${uploadId}-${i}.part`)).catch(() => {})
    )
  );

  const { size } = await stat(finalPath);
  return NextResponse.json({ success: true, complete: true, url: `/uploads/${filename}`, filename, size });
}
