/**
 * AI Service
 * Frontend service for NoteGenerator and AI configuration
 * Communicates with backend to generate notes and manage AI settings
 */

import NetworkConfig from '../config/network';

// Get the appropriate API URL from centralized config
const getApiUrl = () => NetworkConfig.getApiUrl();

/**
 * Generate notes from transcript
 * @param {string} transcript - The lecture transcript text
 * @param {Object} options - Generation options
 * @param {string} options.type - 'full', 'summary', or 'keypoints'
 * @param {boolean} options.forceLocal - Force use of Ollama
 * @param {boolean} options.forceRemote - Force use of ChatGPT
 * @returns {Promise<Object>} Generated notes
 */
export const generateNotes = async (transcript, options = {}) => {
  const { type = 'full', forceLocal, forceRemote } = options;

  try {
    const response = await fetch(`${getApiUrl()}/notes/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        transcript,
        type,
        forceLocal,
        forceRemote,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error('[AI Service] Generate notes error:', error);
    throw error;
  }
};

/**
 * Get current AI configuration
 * @returns {Promise<Object>} Current configuration
 */
export const getAIConfig = async () => {
  try {
    const response = await fetch(`${getApiUrl()}/ai/config`);

    if (!response.ok) {
      throw new Error(`Failed to get config: ${response.status}`);
    }

    const data = await response.json();
    return data.config;
  } catch (error) {
    console.error('[AI Service] Get config error:', error);
    throw error;
  }
};

/**
 * Update AI configuration
 * @param {Object} settings - New settings
 * @param {boolean} settings.useLocalAI - Whether to use local AI (Ollama)
 * @param {string} settings.openaiModel - OpenAI model to use
 * @param {string} settings.ollamaModel - Ollama model to use
 * @returns {Promise<Object>} Updated configuration
 */
export const updateAIConfig = async (settings) => {
  try {
    const response = await fetch(`${getApiUrl()}/ai/config`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to update config: ${response.status}`);
    }

    const data = await response.json();
    return data.config;
  } catch (error) {
    console.error('[AI Service] Update config error:', error);
    throw error;
  }
};

/**
 * Toggle between local (Ollama) and remote (ChatGPT) AI
 * @returns {Promise<boolean>} New useLocalAI value
 */
export const toggleLocalAI = async () => {
  try {
    const response = await fetch(`${getApiUrl()}/ai/toggle`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Toggle failed: ${response.status}`);
    }

    const data = await response.json();
    return data.useLocalAI;
  } catch (error) {
    console.error('[AI Service] Toggle error:', error);
    throw error;
  }
};

/**
 * Test connection to AI backend
 * @param {string} backend - 'openai', 'ollama', or null for current
 * @returns {Promise<Object>} Test result
 */
export const testAIConnection = async (backend = null) => {
  try {
    const response = await fetch(`${getApiUrl()}/ai/test`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ backend }),
    });

    return response.json();
  } catch (error) {
    console.error('[AI Service] Test connection error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Available OpenAI models
 */
export const OPENAI_MODELS = [
  { id: 'gpt-4-turbo-preview', name: 'GPT-4 Turbo', description: 'Most capable, best for complex tasks' },
  { id: 'gpt-4', name: 'GPT-4', description: 'High capability, slower' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast and cost-effective' },
];

/**
 * Available Ollama models (common ones)
 */
export const OLLAMA_MODELS = [
  { id: 'llama3', name: 'Llama 3', description: 'Meta\'s latest open model' },
  { id: 'llama3:70b', name: 'Llama 3 70B', description: 'Larger, more capable' },
  { id: 'mistral', name: 'Mistral 7B', description: 'Fast and efficient' },
  { id: 'mixtral', name: 'Mixtral 8x7B', description: 'Mixture of experts model' },
  { id: 'gemma:7b', name: 'Gemma 7B', description: 'Google\'s open model' },
];

export default {
  generateNotes,
  getAIConfig,
  updateAIConfig,
  toggleLocalAI,
  testAIConnection,
  OPENAI_MODELS,
  OLLAMA_MODELS,
};
