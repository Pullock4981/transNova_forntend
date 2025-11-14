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

  /**
   * Generate content with optional conversation history
   * Supports both single prompts and multi-turn conversations
   * 
   * @param {String|Array} promptOrMessages - Single prompt string or array of messages [{role, content}]
   * @param {Object} options - Generation options
   * @returns {String} Generated content
   */
  async generateContent(promptOrMessages, options = {}) {
    const { temperature = 0.7, maxTokens = 2048, maxRetries = 3, model, skipCache = false } = options;
    const modelToUse = model || this.model;
    
    // Convert single prompt to messages array if needed
    const messages = Array.isArray(promptOrMessages)
      ? promptOrMessages
      : [{ role: 'user', content: promptOrMessages }];
    
    let lastError;
    
    // Retry logic with exponential backoff for rate limits
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const completion = await this.openai.chat.completions.create({
          model: modelToUse,
          messages,
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

  /**
   * Generate streaming content (word-by-word)
   * Uses OpenAI streaming API for real-time word-by-word responses
   * 
   * @param {String|Array} promptOrMessages - Single prompt or message array
   * @param {Object} options - Generation options
   * @param {Function} onChunk - Callback for each chunk: (chunk: string) => void
   * @returns {Promise<String>} Full response
   */
  async generateContentStream(promptOrMessages, options = {}, onChunk = null) {
    const { temperature = 0.7, maxTokens = 2048, model } = options;
    const modelToUse = model || this.model;
    
    // Convert single prompt to messages array if needed
    const messages = Array.isArray(promptOrMessages)
      ? promptOrMessages
      : [{ role: 'user', content: promptOrMessages }];
    
    try {
      const stream = await this.openai.chat.completions.create({
        model: modelToUse,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true, // Enable streaming
      });
      
      let fullResponse = '';
      
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          // Call callback for each chunk
          if (onChunk && typeof onChunk === 'function') {
            onChunk(content);
          }
        }
      }
      
      return fullResponse;
    } catch (error) {
      console.error('Streaming Error:', error);
      throw new Error(`AI streaming failed: ${error.message}`);
    }
  }

  /**
   * Generate structured JSON response with schema validation
   * 
   * @param {String|Array} promptOrMessages - Single prompt or message array
   * @param {Object} schema - Expected JSON schema (for validation)
   * @param {Object} options - Generation options
   * @returns {Object} Parsed and validated JSON
   */
  async generateStructuredJSON(promptOrMessages, schema = null, options = {}) {
    try {
      const prompt = Array.isArray(promptOrMessages)
        ? promptOrMessages[promptOrMessages.length - 1].content
        : promptOrMessages;
      
      // Add schema instructions if provided
      let structuredPrompt = Array.isArray(promptOrMessages)
        ? [...promptOrMessages]
        : promptOrMessages;
      
      if (schema) {
        const schemaInstructions = `\n\nIMPORTANT: Return valid JSON matching this schema:\n${JSON.stringify(schema, null, 2)}\n\nReturn valid JSON only, no markdown, no code blocks. Ensure all required fields are present.`;
        
        if (Array.isArray(structuredPrompt)) {
          structuredPrompt = [
            ...structuredPrompt.slice(0, -1),
            { role: structuredPrompt[structuredPrompt.length - 1].role, content: structuredPrompt[structuredPrompt.length - 1].content + schemaInstructions }
          ];
        } else {
          structuredPrompt = prompt + schemaInstructions;
        }
      } else {
        const jsonInstruction = `\n\nReturn valid JSON only, no markdown, no code blocks.`;
        if (Array.isArray(structuredPrompt)) {
          structuredPrompt = [
            ...structuredPrompt.slice(0, -1),
            { role: structuredPrompt[structuredPrompt.length - 1].role, content: structuredPrompt[structuredPrompt.length - 1].content + jsonInstruction }
          ];
        } else {
          structuredPrompt = prompt + jsonInstruction;
        }
      }
      
      const response = await this.generateContent(structuredPrompt, options);
      
      // Clean response (remove markdown code blocks if present)
      let cleaned = response.trim();
      if (cleaned.startsWith('```json')) {
        cleaned = cleaned.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(cleaned);
      
      // Validate against schema if provided
      if (schema) {
        this.validateSchema(parsed, schema);
      }
      
      return parsed;
    } catch (error) {
      console.error('JSON Parsing Error:', error);
      // Try to extract JSON from response
      try {
        const response = Array.isArray(promptOrMessages)
          ? ''
          : promptOrMessages;
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (schema) {
            this.validateSchema(parsed, schema);
          }
          return parsed;
        }
      } catch (e) {
        // Ignore
      }
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }

  /**
   * Validate JSON object against schema
   * 
   * @param {Object} data - Data to validate
   * @param {Object} schema - Schema definition
   * @throws {Error} If validation fails
   */
  validateSchema(data, schema) {
    if (!schema || typeof schema !== 'object') return;
    
    // Check required fields
    if (schema.required && Array.isArray(schema.required)) {
      for (const field of schema.required) {
        if (!(field in data)) {
          throw new Error(`Missing required field: ${field}`);
        }
      }
    }
    
    // Check field types
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (field in data) {
          const expectedType = fieldSchema.type;
          const actualType = Array.isArray(data[field]) ? 'array' : typeof data[field];
          
          if (expectedType && actualType !== expectedType) {
            console.warn(`Schema validation warning: Field '${field}' expected type '${expectedType}', got '${actualType}'`);
          }
        }
      }
    }
  }
}

module.exports = new AIService();

