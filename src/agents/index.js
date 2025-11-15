/**
 * Agents Index
 * 
 * Centralized exports for all AI agents
 * Makes it easy to import agents with clear, self-explanatory names
 * 
 * All agents follow industry-level standards with:
 * - Comprehensive documentation
 * - ChromaDB integration for semantic search
 * - Error handling and graceful degradation
 * - Consistent API patterns
 */

const jobMatchPercentageAgent = require('./jobMatchPercentageAgent');
const careerMentorAgent = require('./careerMentorAgent');
const skillGapAnalysisAgent = require('./skillGapAnalysisAgent');
const careerRoadmapAgent = require('./careerRoadmapAgent');
const cvProfileAssistantAgent = require('./cvProfileAssistantAgent');
const cvExtractionAgent = require('./cvExtractionAgent');
const jobApplicationAgent = require('./jobApplicationAgent');

module.exports = {
  jobMatchPercentageAgent,
  careerMentorAgent,
  skillGapAnalysisAgent,
  careerRoadmapAgent,
  cvProfileAssistantAgent,
  cvExtractionAgent,
  jobApplicationAgent,
};

