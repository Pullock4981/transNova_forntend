const pdfParse = require('pdf-parse');

class PDFService {
  async extractTextFromPDF(buffer) {
    try {
      if (!buffer || buffer.length === 0) {
        throw new Error('PDF buffer is empty');
      }

      const data = await pdfParse(buffer);
      const text = data.text.trim();

      if (!text || text.length < 50) {
        throw new Error('PDF appears to be empty or contains no readable text');
      }

      return text;
    } catch (error) {
      throw new Error(`Failed to extract text from PDF: ${error.message}`);
    }
  }

  async validatePDF(buffer) {
    try {
      // Check if it's a valid PDF by trying to parse it
      const data = await pdfParse(buffer);
      return {
        valid: true,
        pages: data.numpages,
        info: data.info,
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }
}

module.exports = new PDFService();

