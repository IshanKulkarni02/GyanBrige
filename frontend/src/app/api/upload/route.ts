import { NextRequest, NextResponse } from 'next/server';
import { mkdir, appendFile, rename, unlink, stat } from 'fs/promises';
import path from 'path';

// Increase max duration for uploads
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Check if this is a chunked upload
    const chunkIndex = formData.get('chunkIndex');
    const totalChunks = formData.get('totalChunks');
    const uploadId = formData.get('uploadId');
    
    if (chunkIndex !== null && totalChunks !== null && uploadId) {
      // Chunked upload
      return handleChunkedUpload(formData);
    }
    
    // Regular single-file upload (for smaller files)
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadsDir, { recursive: true });

    // Generate unique filename
    const timestamp = Date.now();
    const extension = file.name.split('.').pop();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    const filepath = path.join(uploadsDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await appendFile(filepath, buffer);

    // Return the public URL
    const url = `/uploads/${filename}`;
    
    return NextResponse.json({ 
      success: true, 
      url,
      filename,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}

async function handleChunkedUpload(formData: FormData) {
  const chunk = formData.get('chunk') as File;
  const chunkIndex = parseInt(formData.get('chunkIndex') as string);
  const totalChunks = parseInt(formData.get('totalChunks') as string);
  const uploadId = formData.get('uploadId') as string;
  const originalName = formData.get('originalName') as string;
  
  if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !uploadId) {
    return NextResponse.json({ error: 'Invalid chunk data' }, { status: 400 });
  }

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  const tempDir = path.join(process.cwd(), 'tmp', 'uploads');
  await mkdir(uploadsDir, { recursive: true });
  await mkdir(tempDir, { recursive: true });

  // Temp file path for assembling chunks
  const tempFilePath = path.join(tempDir, `${uploadId}.tmp`);
  
  // Write chunk to temp file
  const bytes = await chunk.arrayBuffer();
  const buffer = Buffer.from(bytes);
  await appendFile(tempFilePath, buffer);

  // If this is the last chunk, finalize the file
  if (chunkIndex === totalChunks - 1) {
    const extension = originalName?.split('.').pop() || 'mp4';
    const timestamp = Date.now();
    const filename = `${timestamp}-${Math.random().toString(36).substring(7)}.${extension}`;
    const finalPath = path.join(uploadsDir, filename);
    
    // Move temp file to final location
    await rename(tempFilePath, finalPath);
    
    // Get file size
    const fileStats = await stat(finalPath);
    
    return NextResponse.json({ 
      success: true, 
      complete: true,
      url: `/uploads/${filename}`,
      filename,
      size: fileStats.size,
    });
  }

  return NextResponse.json({ 
    success: true, 
    complete: false,
    chunkIndex,
    received: chunkIndex + 1,
    total: totalChunks,
  });
}

