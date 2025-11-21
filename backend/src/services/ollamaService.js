const axios = require('axios');

class OllamaService {
  constructor() {
    this.apiUrl = process.env.OLLAMA_API_URL || 'http://localhost:11434';
    this.model = 'llama3';
  }

  /**
   * Generate notes from video transcript or content
   */
  async generateNotes(content, options = {}) {
    try {
      const prompt = this.buildNotesPrompt(content, options);
      
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
        }
      });

      const notes = this.parseNotesResponse(response.data.response);
      
      return {
        success: true,
        notes,
        rawResponse: response.data.response
      };
    } catch (error) {
      console.error('Ollama API error:', error.message);
      throw new Error('Failed to generate notes: ' + error.message);
    }
  }

  /**
   * Generate summary from video content
   */
  async generateSummary(content) {
    try {
      const prompt = `Provide a concise summary of the following content:\n\n${content}\n\nSummary:`;
      
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false
      });

      return {
        success: true,
        summary: response.data.response.trim()
      };
    } catch (error) {
      console.error('Ollama API error:', error.message);
      throw new Error('Failed to generate summary: ' + error.message);
    }
  }

  /**
   * Generate key points from content
   */
  async generateKeyPoints(content) {
    try {
      const prompt = `Extract the main key points from the following content. List them as bullet points:\n\n${content}\n\nKey Points:`;
      
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: false
      });

      return {
        success: true,
        keyPoints: this.parseKeyPoints(response.data.response)
      };
    } catch (error) {
      console.error('Ollama API error:', error.message);
      throw new Error('Failed to generate key points: ' + error.message);
    }
  }

  /**
   * Stream notes generation (for real-time updates)
   */
  async *streamNotesGeneration(content) {
    try {
      const prompt = this.buildNotesPrompt(content);
      
      const response = await axios.post(`${this.apiUrl}/api/generate`, {
        model: this.model,
        prompt: prompt,
        stream: true
      }, {
        responseType: 'stream'
      });

      for await (const chunk of response.data) {
        const lines = chunk.toString().split('\n').filter(line => line.trim());
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.response) {
              yield data.response;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    } catch (error) {
      console.error('Ollama streaming error:', error.message);
      throw error;
    }
  }

  /**
   * Build comprehensive notes prompt
   */
  buildNotesPrompt(content, options = {}) {
    const {
      includeExamples = true,
      includeQuestions = true,
      format = 'structured'
    } = options;

    let prompt = `You are an educational assistant. Generate comprehensive study notes from the following content.\n\n`;
    prompt += `Content:\n${content}\n\n`;
    prompt += `Please provide:\n`;
    prompt += `1. A brief overview\n`;
    prompt += `2. Main concepts and topics\n`;
    prompt += `3. Detailed explanations\n`;
    
    if (includeExamples) {
      prompt += `4. Examples and illustrations\n`;
    }
    
    if (includeQuestions) {
      prompt += `5. Practice questions or discussion points\n`;
    }
    
    prompt += `\nFormat the notes in a clear, organized structure:\n\nNotes:`;
    
    return prompt;
  }

  /**
   * Parse notes response into structured format
   */
  parseNotesResponse(response) {
    return {
      content: response.trim(),
      sections: this.extractSections(response),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Extract sections from notes
   */
  extractSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = null;

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.match(/^#+\s+/) || trimmed.match(/^\d+\.\s+[A-Z]/)) {
        if (currentSection) {
          sections.push(currentSection);
        }
        currentSection = {
          title: trimmed.replace(/^#+\s+/, '').replace(/^\d+\.\s+/, ''),
          content: []
        };
      } else if (currentSection && trimmed) {
        currentSection.content.push(trimmed);
      }
    });

    if (currentSection) {
      sections.push(currentSection);
    }

    return sections;
  }

  /**
   * Parse key points from response
   */
  parseKeyPoints(response) {
    const lines = response.split('\n');
    const keyPoints = [];

    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed.match(/^[-*•]\s+/) || trimmed.match(/^\d+\.\s+/)) {
        keyPoints.push(trimmed.replace(/^[-*•]\s+/, '').replace(/^\d+\.\s+/, ''));
      }
    });

    return keyPoints;
  }

  /**
   * Check if Ollama is available
   */
  async checkHealth() {
    try {
      const response = await axios.get(`${this.apiUrl}/api/tags`);
      return {
        available: true,
        models: response.data.models
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = new OllamaService();
