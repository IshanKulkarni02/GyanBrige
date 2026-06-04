/**
 * Transcription Service
 * Handles audio file upload and transcription via Whisper API
 * Supports English, Hindi, Marathi, and mixed-language transcription
 */

import * as FileSystem from 'expo-file-system';
import NetworkConfig from '../config/network';

// Get the appropriate API URL from centralized config
const getApiUrl = () => NetworkConfig.getApiUrl();

/**
 * Language code mapping for Whisper
 */
const WHISPER_LANGUAGE_MAP = {
  en: 'english',
  hi: 'hindi',
  mr: 'marathi',
  mixed: null, // Let Whisper auto-detect for mixed content
};

/**
 * Transcription result interface
 * @typedef {Object} TranscriptionResult
 * @property {string} text - The full transcription text
 * @property {Array} segments - Timestamped segments
 * @property {string} language - Detected/specified language
 * @property {number} duration - Audio duration in seconds
 * @property {Object} metadata - Additional metadata
 */

/**
 * Upload and transcribe audio file
 * @param {string} audioUri - Local URI of the audio file
 * @param {Object} options - Transcription options
 * @param {string} options.language - Language code (en, hi, mr, mixed)
 * @param {boolean} options.timestamps - Include word-level timestamps
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<TranscriptionResult>}
 */
export const transcribeAudio = async (audioUri, options = {}) => {
  const {
    language = 'mixed',
    timestamps = true,
    onProgress,
    lectureId,
    title,
  } = options;

  try {
    onProgress?.({ status: 'preparing', progress: 0 });

    // Read file info
    const fileInfo = await FileSystem.getInfoAsync(audioUri);
    if (!fileInfo.exists) {
      throw new Error('Audio file not found');
    }

    onProgress?.({ status: 'uploading', progress: 10 });

    // Create form data for upload
    const formData = new FormData();
    
    // Determine file extension and mime type
    const extension = audioUri.split('.').pop()?.toLowerCase() || 'wav';
    const mimeType = extension === 'wav' ? 'audio/wav' : 
                     extension === 'mp3' ? 'audio/mpeg' : 
                     extension === 'webm' ? 'audio/webm' : 'audio/wav';

    // Append the audio file
    formData.append('audio', {
      uri: audioUri,
      type: mimeType,
      name: `recording_${Date.now()}.${extension}`,
    });

    // Append options
    formData.append('language', language);
    formData.append('timestamps', String(timestamps));
    if (lectureId) formData.append('lectureId', lectureId);
    if (title) formData.append('title', title);

    onProgress?.({ status: 'uploading', progress: 30 });

    // Upload and transcribe
    const response = await fetch(`${getApiUrl()}/transcribe`, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
      },
    });

    onProgress?.({ status: 'processing', progress: 60 });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Server error: ${response.status}`);
    }

    const result = await response.json();

    onProgress?.({ status: 'complete', progress: 100 });

    return {
      success: true,
      text: result.text,
      segments: result.segments || [],
      language: result.language || language,
      duration: result.duration,
      metadata: {
        model: result.model,
        processingTime: result.processingTime,
        confidence: result.confidence,
      },
    };
  } catch (error) {
    console.error('Transcription error:', error);
    onProgress?.({ status: 'error', progress: 0, error: error.message });
    
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Transcribe audio using streaming (for real-time feedback)
 * Uses Server-Sent Events for progress updates
 */
export const transcribeAudioStreaming = async (audioUri, options = {}) => {
  const {
    language = 'mixed',
    onSegment,
    onProgress,
    onComplete,
    onError,
  } = options;

  try {
    // First, upload the file
    const uploadResult = await uploadAudioForStreaming(audioUri, language);
    
    if (!uploadResult.success) {
      throw new Error(uploadResult.error);
    }

    // Connect to SSE endpoint for streaming results
    const eventSource = new EventSource(
      `${getApiUrl()}/transcribe/stream/${uploadResult.jobId}`
    );

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'segment':
          onSegment?.(data.segment);
          break;
        case 'progress':
          onProgress?.(data.progress);
          break;
        case 'complete':
          onComplete?.(data.result);
          eventSource.close();
          break;
        case 'error':
          onError?.(data.error);
          eventSource.close();
          break;
      }
    };

    eventSource.onerror = (error) => {
      onError?.(error);
      eventSource.close();
    };

    return {
      success: true,
      jobId: uploadResult.jobId,
      cancel: () => eventSource.close(),
    };
  } catch (error) {
    onError?.(error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Upload audio file for streaming transcription
 */
const uploadAudioForStreaming = async (audioUri, language) => {
  const formData = new FormData();
  
  const extension = audioUri.split('.').pop()?.toLowerCase() || 'wav';
  const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/mpeg';

  formData.append('audio', {
    uri: audioUri,
    type: mimeType,
    name: `recording_${Date.now()}.${extension}`,
  });
  formData.append('language', language);
  formData.append('streaming', 'true');

  const response = await fetch(`${getApiUrl()}/transcribe/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }

  return response.json();
};

/**
 * Get transcription status
 */
export const getTranscriptionStatus = async (jobId) => {
  try {
    const response = await fetch(`${getApiUrl()}/transcribe/status/${jobId}`);
    
    if (!response.ok) {
      throw new Error(`Status check failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Generate AI notes from transcription
 */
export const generateNotesFromTranscription = async (transcriptionId, options = {}) => {
  const {
    style = 'structured', // structured, bullet, summary
    includeTimestamps = true,
    language = 'en',
  } = options;

  try {
    const response = await fetch(`${getApiUrl()}/notes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcriptionId,
        style,
        includeTimestamps,
        language,
      }),
    });

    if (!response.ok) {
      throw new Error(`Notes generation failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Save transcription to lecture
 */
export const saveTranscriptionToLecture = async (lectureId, transcription, notes) => {
  try {
    const response = await fetch(`${getApiUrl()}/lectures/${lectureId}/transcription`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcription,
        notes,
      }),
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

export default {
  transcribeAudio,
  transcribeAudioStreaming,
  getTranscriptionStatus,
  generateNotesFromTranscription,
  saveTranscriptionToLecture,
};
