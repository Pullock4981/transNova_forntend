const OpenAI = require('openai');

class AIService {
  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is required in environment variables');
    }
    
    // Check if it's an OpenRouter key (starts with 'sk-or-')
    const isOpenRouter = apiKey.startsWith('sk-or-');
    
    if (isOpenRouter) {
      // Use OpenRouter endpoint
      this.openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.APP_URL || 'https://transnova.app',
          'X-Title': 'TransNova Career Platform',
        },
      });
      console.log('✅ Using OpenRouter API');
    } else {
      // Use OpenAI endpoint
      this.openai = new OpenAI({ apiKey });
      console.log('✅ Using OpenAI API');
    }
    
    // Default model - gpt-4o-mini works with both OpenAI and OpenRouter
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async generateContent(prompt, options = {}) {
    const { temperature = 0.7, maxTokens = 2048, maxRetries = 3, model } = options;
    const modelToUse = model || this.model;
    let lastError;
    
    // Retry logic with exponential backoff for rate limits
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: modelToUse,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        });
        
        const response = completion.choices[0]?.message?.content;
        if (response) {
          return response;
        }
        throw new Error('No response from OpenAI');
      } catch (error) {
        lastError = error;
        const errorMessage = error.message || '';
        const statusCode = error.status || error.response?.status;
        
        // Check for rate limit or quota errors
        if (statusCode === 429 || errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          // Extract retry delay from error if available
          let retryDelay = 60000; // Default 60 seconds for OpenAI rate limits
          
          // Try to extract retry delay from error headers
          try {
            const retryAfter = error.response?.headers?.['retry-after'];
            if (retryAfter) {
              retryDelay = parseInt(retryAfter) * 1000;
            }
          } catch (e) {
            // Use default
          }
          
          if (attempt < maxRetries - 1) {
            console.warn(`⚠️  Rate limit hit (attempt ${attempt + 1}/${maxRetries}). Waiting ${retryDelay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue; // Retry
          }
        } else if (statusCode === 503 || errorMessage.includes('503') || errorMessage.includes('overloaded')) {
          // Service unavailable - retry with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          if (attempt < maxRetries - 1) {
            console.warn(`⚠️  Service overloaded (attempt ${attempt + 1}/${maxRetries}). Waiting ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue; // Retry
          }
        } else {
          // Other errors - don't retry
          throw error;
        }
      }
    }
    
    // All retries failed
    console.error('AI Service Error (after retries):', lastError);
    throw new Error(`AI generation failed: ${lastError.message}`);
  }

  async generateStructuredJSON(prompt, schema) {
    try {
      const structuredPrompt = `${prompt}\n\nReturn valid JSON only, no markdown, no code blocks.`;
      const response = await this.generateContent(structuredPrompt);
      
      // Clean response (remove markdown code blocks if present)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }
      
      return JSON.parse(cleaned);
    } catch (error) {
      console.error('JSON Parsing Error:', error);
      // Try to extract JSON from response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        // Ignore
      }
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }
}

module.exports = new AIService();

