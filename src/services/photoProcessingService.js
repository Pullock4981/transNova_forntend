const RemoveBg = require('remove.bg');
const sharp = require('sharp');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs').promises;
const path = require('path');

/**
 * Photo Processing Service
 * 
 * Purpose: Process user photos to create formal CV-ready images
 * 
 * Features:
 * - Remove background using Remove.bg API
 * - Add professional solid background (white/light gray/blue)
 * - Resize to CV-appropriate dimensions
 * - Optimize image quality
 * 
 * Usage:
 *   const service = require('./services/photoProcessingService');
 *   const processedImage = await service.processPhotoForCV(imageBuffer, 'white');
 */
class PhotoProcessingService {
  constructor() {
    this.apiKey = process.env.REMOVE_BG_API_KEY;
    if (!this.apiKey) {
      console.warn('⚠️  REMOVE_BG_API_KEY not found. Photo processing will be limited.');
    }
  }

  /**
   * Remove background from image using Remove.bg API
   * @param {Buffer} imageBuffer - Original image buffer
   * @returns {Buffer} Image buffer with background removed
   */
  async removeBackground(imageBuffer) {
    if (!this.apiKey) {
      throw new Error('REMOVE_BG_API_KEY is required for background removal');
    }

    try {
      // Use remove.bg API directly via axios (more reliable than the npm package)
      const formData = new FormData();
      formData.append('image_file', imageBuffer, {
        filename: 'photo.jpg',
        contentType: 'image/jpeg',
      });
      formData.append('size', 'regular');

      const response = await axios.post('https://api.remove.bg/v1.0/removebg', formData, {
        headers: {
          ...formData.getHeaders(),
          'X-Api-Key': this.apiKey,
        },
        responseType: 'arraybuffer',
        timeout: 30000, // 30 second timeout
      });

      return Buffer.from(response.data);
    } catch (error) {
      console.error('Remove.bg API error:', error.message);
      if (error.response) {
        throw new Error(`Background removal failed: ${error.response.data?.error?.message || error.message}`);
      }
      throw new Error(`Background removal failed: ${error.message}`);
    }
  }

  /**
   * Add professional background to image
   * @param {Buffer} imageBuffer - Image buffer (with or without background)
   * @param {String} backgroundColor - Background color ('white', 'light-gray', 'blue', 'custom')
   * @param {String} customColor - Custom hex color (if backgroundColor is 'custom')
   * @returns {Buffer} Image buffer with professional background
   */
  async addProfessionalBackground(imageBuffer, backgroundColor = 'white', customColor = null) {
    try {
      // Define background colors
      const colorMap = {
        'white': '#FFFFFF',
        'light-gray': '#F5F5F5',
        'blue': '#E3F2FD',
        'custom': customColor || '#FFFFFF',
      };

      const bgColor = colorMap[backgroundColor] || colorMap['white'];

      // Get image dimensions
      const metadata = await sharp(imageBuffer).metadata();
      const width = metadata.width || 800;
      const height = metadata.height || 800;

      // Create professional background image buffer
      const backgroundBuffer = await sharp({
        create: {
          width: width,
          height: height,
          channels: 3,
          background: bgColor,
        },
      })
        .png()
        .toBuffer();

      // Composite the image on top of the background
      const processedImage = await sharp(backgroundBuffer)
        .composite([
          {
            input: imageBuffer,
            blend: 'over',
          },
        ])
        .png()
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.error('Error adding background:', error.message);
      throw new Error(`Failed to add background: ${error.message}`);
    }
  }

  /**
   * Resize image to CV-appropriate dimensions
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Number} size - Target size (default: 400x400px for CV photos)
   * @returns {Buffer} Resized image buffer
   */
  async resizeForCV(imageBuffer, size = 400) {
    try {
      const resized = await sharp(imageBuffer)
        .resize(size, size, {
          fit: 'cover',
          position: 'center',
        })
        .png()
        .toBuffer();

      return resized;
    } catch (error) {
      console.error('Error resizing image:', error.message);
      throw new Error(`Failed to resize image: ${error.message}`);
    }
  }

  /**
   * Process photo for CV - complete pipeline
   * @param {Buffer} imageBuffer - Original image buffer
   * @param {String} backgroundColor - Background color preference
   * @param {Object} options - Processing options
   * @returns {Object} Processed image data
   */
  async processPhotoForCV(imageBuffer, backgroundColor = 'white', options = {}) {
    try {
      const { removeBg = true, resize = true, targetSize = 400 } = options;

      let processedBuffer = imageBuffer;

      // Step 1: Remove background (if enabled and API key available)
      if (removeBg && this.apiKey) {
        console.log('🔄 Removing background...');
        processedBuffer = await this.removeBackground(imageBuffer);
        console.log('✅ Background removed');
      }

      // Step 2: Add professional background
      console.log('🔄 Adding professional background...');
      processedBuffer = await this.addProfessionalBackground(processedBuffer, backgroundColor);
      console.log('✅ Professional background added');

      // Step 3: Resize for CV (if enabled)
      if (resize) {
        console.log('🔄 Resizing for CV...');
        processedBuffer = await this.resizeForCV(processedBuffer, targetSize);
        console.log('✅ Image resized');
      }

      // Convert to base64 for easy storage/transmission
      const base64Image = processedBuffer.toString('base64');
      const dataUri = `data:image/png;base64,${base64Image}`;

      return {
        imageBuffer: processedBuffer,
        base64: base64Image,
        dataUri: dataUri,
        size: processedBuffer.length,
        dimensions: await this.getImageDimensions(processedBuffer),
      };
    } catch (error) {
      console.error('Photo processing error:', error);
      throw new Error(`Failed to process photo: ${error.message}`);
    }
  }

  /**
   * Get image dimensions
   * @param {Buffer} imageBuffer - Image buffer
   * @returns {Object} Image dimensions
   */
  async getImageDimensions(imageBuffer) {
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        width: metadata.width,
        height: metadata.height,
      };
    } catch (error) {
      return { width: 0, height: 0 };
    }
  }

  /**
   * Validate image file
   * @param {Buffer} imageBuffer - Image buffer
   * @param {Number} maxSize - Maximum file size in bytes (default: 5MB)
   * @returns {Boolean} True if valid
   */
  async validateImage(imageBuffer, maxSize = 5 * 1024 * 1024) {
    try {
      // Check file size
      if (imageBuffer.length > maxSize) {
        throw new Error(`Image size exceeds ${maxSize / 1024 / 1024}MB limit`);
      }

      // Validate it's a valid image
      const metadata = await sharp(imageBuffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image format');
      }

      // Check if format is supported
      const supportedFormats = ['jpeg', 'jpg', 'png', 'webp'];
      if (!supportedFormats.includes(metadata.format)) {
        throw new Error(`Unsupported image format: ${metadata.format}. Supported: ${supportedFormats.join(', ')}`);
      }

      return true;
    } catch (error) {
      throw new Error(`Image validation failed: ${error.message}`);
    }
  }
}

module.exports = new PhotoProcessingService();

