/**
 * NoteGenerator Service
 * Generates structured notes from lecture transcripts using AI
 * Supports both ChatGPT (OpenAI) and Ollama (local AI)
 * 
 * Toggle USE_LOCAL_AI to switch between backends:
 * - false: Use ChatGPT (OpenAI API)
 * - true: Use Ollama (local)
 */

const fs = require('fs');
const path = require('path');

// ============ GLOBAL CONFIGURATION ============

// Global toggle - Admin can change this to switch AI backends
// This can also be controlled via environment variable or config file
let USE_LOCAL_AI = process.env.USE_LOCAL_AI === 'true' || false;

// Configuration
const CONFIG = {
  // OpenAI (ChatGPT) settings
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
    maxTokens: 4000,
    temperature: 0.3, // Lower for more consistent output
  },
  
  // Ollama (Local AI) settings
  ollama: {
    baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'llama3', // or 'mistral', 'mixtral', etc.
  },
  
  // Config file path for persistent settings
  configPath: path.join(__dirname, '..', 'config', 'ai-settings.json'),
};

// ============ CONFIGURATION MANAGEMENT ============

/**
 * Load settings from config file
 */
function loadSettings() {
  try {
    if (fs.existsSync(CONFIG.configPath)) {
      const settings = JSON.parse(fs.readFileSync(CONFIG.configPath, 'utf-8'));
      USE_LOCAL_AI = settings.useLocalAI ?? USE_LOCAL_AI;
      if (settings.openaiModel) CONFIG.openai.model = settings.openaiModel;
      if (settings.ollamaModel) CONFIG.ollama.model = settings.ollamaModel;
      console.log(`[NoteGenerator] Loaded settings: USE_LOCAL_AI = ${USE_LOCAL_AI}`);
    }
  } catch (error) {
    console.error('[NoteGenerator] Failed to load settings:', error.message);
  }
}

/**
 * Save settings to config file
 */
function saveSettings() {
  try {
    const configDir = path.dirname(CONFIG.configPath);
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const settings = {
      useLocalAI: USE_LOCAL_AI,
      openaiModel: CONFIG.openai.model,
      ollamaModel: CONFIG.ollama.model,
      updatedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(CONFIG.configPath, JSON.stringify(settings, null, 2));
    console.log(`[NoteGenerator] Settings saved: USE_LOCAL_AI = ${USE_LOCAL_AI}`);
  } catch (error) {
    console.error('[NoteGenerator] Failed to save settings:', error.message);
  }
}

// Load settings on startup
loadSettings();

// ============ PROMPT TEMPLATES ============

/**
 * Language name resolver. Output prompts ask the model to write notes
 * in the given language; transcripts can still mix English / Hindi / Marathi
 * (or anything Whisper picked up).
 */
const LANG_NAMES = {
  en: 'English',
  hi: 'Hindi (Devanagari script)',
  mr: 'Marathi (Devanagari script)',
  ta: 'Tamil',
  te: 'Telugu',
  bn: 'Bengali',
  gu: 'Gujarati',
  kn: 'Kannada',
  ml: 'Malayalam',
  pa: 'Punjabi',
  ur: 'Urdu',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
};

function langName(code) {
  if (!code || code === 'mixed' || code === 'auto') return 'English';
  return LANG_NAMES[code] || code;
}

function notesPrompt(outputLanguage) {
  const lang = langName(outputLanguage);
  return `Summarize this lecture transcript into structured notes with headings and bullet points. The transcript may be a mix of English, Hindi, Marathi, or other languages.

Requirements:
1. Create a clear title for the lecture
2. Write a brief summary (2-3 sentences)
3. Organize content into logical sections with headings
4. Use bullet points for key concepts
5. Highlight important terms, formulas, or definitions
6. Include any examples mentioned
7. Add a "Key Takeaways" section at the end
8. Write all notes in ${lang}. Preserve technical terms in their original language if translation would lose meaning, but keep the surrounding text in ${lang}.

Format the output as JSON with this structure:
{
  "title": "Lecture Title",
  "summary": "Brief summary of the lecture",
  "sections": [
    {
      "heading": "Section Heading",
      "content": ["Bullet point 1", "Bullet point 2"],
      "keyTerms": ["term1", "term2"]
    }
  ],
  "keyTakeaways": ["Takeaway 1", "Takeaway 2"],
  "additionalNotes": "Any additional context"
}

TRANSCRIPT:
`;
}

function summaryPrompt(outputLanguage) {
  const lang = langName(outputLanguage);
  return `Provide a concise summary (3-5 sentences) of this lecture transcript. The transcript may mix multiple languages. Write the summary in ${lang}.

TRANSCRIPT:
`;
}

function keyPointsPrompt(outputLanguage) {
  const lang = langName(outputLanguage);
  return `Extract 5-10 key points from this lecture transcript as a bullet list. The transcript may mix multiple languages. Write all key points in ${lang}.

TRANSCRIPT:
`;
}

// ============ AI BACKENDS ============

/**
 * Generate notes using OpenAI ChatGPT
 */
async function generateWithChatGPT(transcript, promptType = 'full', outputLanguage = 'en') {
  const OpenAI = require('openai');

  if (!CONFIG.openai.apiKey) {
    throw new Error('OpenAI API key not configured. Set OPENAI_API_KEY environment variable.');
  }

  const openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
  const prompt = getPromptForType(promptType, outputLanguage);
  const targetLang = langName(outputLanguage);

  console.log(`[ChatGPT] Generating ${promptType} notes in ${targetLang} using ${CONFIG.openai.model}`);

  const response = await openai.chat.completions.create({
    model: CONFIG.openai.model,
    messages: [
      {
        role: 'system',
        content: `You are an expert educational content summarizer. You understand English, Hindi, Marathi and many other languages. Output the notes in ${targetLang}.`,
      },
      { role: 'user', content: prompt + transcript },
    ],
    max_tokens: CONFIG.openai.maxTokens,
    temperature: CONFIG.openai.temperature,
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('No response from ChatGPT');

  const parsed = parseAIResponse(content, promptType);
  parsed.outputLanguage = outputLanguage;
  return parsed;
}

/**
 * Generate notes using Ollama (local AI)
 */
async function generateWithOllama(transcript, promptType = 'full', outputLanguage = 'en') {
  const fetch = require('node-fetch');
  const prompt = getPromptForType(promptType, outputLanguage);
  const targetLang = langName(outputLanguage);

  console.log(`[Ollama] Generating ${promptType} notes in ${targetLang} using ${CONFIG.ollama.model}`);

  const response = await fetch(`${CONFIG.ollama.baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CONFIG.ollama.model,
      prompt: prompt + transcript,
      system: `You are an expert educational content summarizer. You understand many languages. Output the notes in ${targetLang}.`,
      stream: false,
      options: { temperature: 0.3, num_predict: 4000 },
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Ollama error (${response.status}): ${error}`);
  }

  const result = await response.json();
  if (!result.response) throw new Error('No response from Ollama');

  const parsed = parseAIResponse(result.response, promptType);
  parsed.outputLanguage = outputLanguage;
  return parsed;
}

/**
 * Get the appropriate prompt for the generation type
 */
function getPromptForType(type, outputLanguage = 'en') {
  switch (type) {
    case 'summary':
      return summaryPrompt(outputLanguage);
    case 'keypoints':
      return keyPointsPrompt(outputLanguage);
    case 'full':
    default:
      return notesPrompt(outputLanguage);
  }
}

/**
 * Parse AI response and extract structured data
 */
function parseAIResponse(content, promptType) {
  try {
    // Try to parse as JSON first
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        success: true,
        type: promptType,
        ...parsed
      };
    }
  } catch (e) {
    // JSON parsing failed, continue with text parsing
  }

  // Fallback: Return as plain text with basic structure
  if (promptType === 'summary') {
    return {
      success: true,
      type: 'summary',
      summary: content.trim(),
    };
  }
  
  if (promptType === 'keypoints') {
    const points = content
      .split('\n')
      .filter(line => line.trim().match(/^[-•*]\s/))
      .map(line => line.replace(/^[-•*]\s/, '').trim());
    
    return {
      success: true,
      type: 'keypoints',
      keyPoints: points.length > 0 ? points : [content.trim()],
    };
  }

  // Full notes - try to extract structure
  return {
    success: true,
    type: 'full',
    title: 'Lecture Notes',
    summary: content.substring(0, 200),
    rawContent: content,
    sections: [{
      heading: 'Notes',
      content: content.split('\n').filter(l => l.trim()),
    }],
    keyTakeaways: [],
  };
}

// ============ MAIN API ============

/**
 * Generate notes from transcript
 * Uses either ChatGPT or Ollama based on USE_LOCAL_AI setting
 * 
 * @param {string} transcript - The lecture transcript
 * @param {Object} options - Generation options
 * @param {string} options.type - 'full', 'summary', or 'keypoints'
 * @param {boolean} options.forceLocal - Force use of Ollama regardless of global setting
 * @param {boolean} options.forceRemote - Force use of ChatGPT regardless of global setting
 * @returns {Promise<Object>} Generated notes
 */
async function generateNotes(transcript, options = {}) {
  const {
    type = 'full',
    forceLocal = false,
    forceRemote = false,
    outputLanguage = 'en',
  } = options;

  if (!transcript || transcript.trim().length === 0) {
    throw new Error('Transcript is required');
  }

  const startTime = Date.now();
  let result;
  let backend;

  const useLocal = forceLocal || (!forceRemote && USE_LOCAL_AI);

  try {
    if (useLocal) {
      backend = 'ollama';
      result = await generateWithOllama(transcript, type, outputLanguage);
    } else {
      backend = 'chatgpt';
      result = await generateWithChatGPT(transcript, type, outputLanguage);
    }

    result.backend = backend;
    result.processingTime = Date.now() - startTime;
    result.model = useLocal ? CONFIG.ollama.model : CONFIG.openai.model;

    console.log(
      `[NoteGenerator] Generated ${type} notes in ${outputLanguage} using ${backend} in ${result.processingTime}ms`,
    );

    return result;
  } catch (error) {
    console.error(`[NoteGenerator] Error with ${backend}:`, error.message);

    if (!forceLocal && !forceRemote) {
      console.log(`[NoteGenerator] Attempting fallback to ${useLocal ? 'ChatGPT' : 'Ollama'}...`);

      try {
        if (useLocal) {
          result = await generateWithChatGPT(transcript, type, outputLanguage);
          backend = 'chatgpt (fallback)';
        } else {
          result = await generateWithOllama(transcript, type, outputLanguage);
          backend = 'ollama (fallback)';
        }

        result.backend = backend;
        result.processingTime = Date.now() - startTime;
        result.fallback = true;
        return result;
      } catch (fallbackError) {
        console.error(`[NoteGenerator] Fallback also failed:`, fallbackError.message);
      }
    }

    throw error;
  }
}

// ============ ADMIN CONTROLS ============

/**
 * Get current AI configuration
 */
function getConfig() {
  return {
    useLocalAI: USE_LOCAL_AI,
    openai: {
      model: CONFIG.openai.model,
      configured: !!CONFIG.openai.apiKey,
    },
    ollama: {
      baseUrl: CONFIG.ollama.baseUrl,
      model: CONFIG.ollama.model,
    },
  };
}

/**
 * Update AI configuration
 * @param {Object} settings - New settings
 * @param {boolean} settings.useLocalAI - Whether to use local AI
 * @param {string} settings.openaiModel - OpenAI model to use
 * @param {string} settings.ollamaModel - Ollama model to use
 */
function updateConfig(settings) {
  if (typeof settings.useLocalAI === 'boolean') {
    USE_LOCAL_AI = settings.useLocalAI;
  }
  if (settings.openaiModel) {
    CONFIG.openai.model = settings.openaiModel;
  }
  if (settings.ollamaModel) {
    CONFIG.ollama.model = settings.ollamaModel;
  }
  
  saveSettings();
  
  return getConfig();
}

/**
 * Toggle between local and remote AI
 */
function toggleLocalAI() {
  USE_LOCAL_AI = !USE_LOCAL_AI;
  saveSettings();
  console.log(`[NoteGenerator] Toggled USE_LOCAL_AI to: ${USE_LOCAL_AI}`);
  return USE_LOCAL_AI;
}

/**
 * Test connection to AI backend
 */
async function testConnection(backend = null) {
  const testBackend = backend || (USE_LOCAL_AI ? 'ollama' : 'openai');
  const testPrompt = 'Say "Connection successful" in exactly those words.';
  
  try {
    if (testBackend === 'ollama') {
      const fetch = require('node-fetch');
      const response = await fetch(`${CONFIG.ollama.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: CONFIG.ollama.model,
          prompt: testPrompt,
          stream: false,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const result = await response.json();
      return {
        success: true,
        backend: 'ollama',
        model: CONFIG.ollama.model,
        response: result.response?.substring(0, 50),
      };
    } else {
      const OpenAI = require('openai');
      const openai = new OpenAI({ apiKey: CONFIG.openai.apiKey });
      
      const response = await openai.chat.completions.create({
        model: CONFIG.openai.model,
        messages: [{ role: 'user', content: testPrompt }],
        max_tokens: 20,
      });
      
      return {
        success: true,
        backend: 'openai',
        model: CONFIG.openai.model,
        response: response.choices[0]?.message?.content?.substring(0, 50),
      };
    }
  } catch (error) {
    return {
      success: false,
      backend: testBackend,
      error: error.message,
    };
  }
}

// ============ EXPORTS ============

module.exports = {
  // Main generation function
  generateNotes,
  
  // Admin controls
  getConfig,
  updateConfig,
  toggleLocalAI,
  testConnection,
  
  // Direct access to backends (for advanced use)
  generateWithChatGPT,
  generateWithOllama,
  
  // Expose USE_LOCAL_AI getter/setter
  get USE_LOCAL_AI() {
    return USE_LOCAL_AI;
  },
  set USE_LOCAL_AI(value) {
    USE_LOCAL_AI = value;
    saveSettings();
  },
};
