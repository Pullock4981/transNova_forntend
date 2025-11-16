const chromaService = require('../services/chromaService');
const Resource = require('../models/Resource');
const User = require('../models/User');

/**
 * Resource Recommendation Agent
 * 
 * Purpose: Provides intelligent, AI-powered learning resource recommendations
 *          based on user profile, skills, and career goals
 * 
 * Responsibilities:
 * - Embeds resources into ChromaDB for semantic search
 * - Uses semantic similarity to find relevant resources
 * - Combines exact matching with semantic matching for better accuracy
 * - Prioritizes resources based on user's current skills and missing skills
 * - Provides personalized learning paths and resource suggestions
 * 
 * Usage:
 *   const agent = require('./agents/resourceRecommendationAgent');
 *   await agent.initialize();
 *   const recommendations = await agent.getResourceRecommendations(userId);
 *   await agent.embedResource(resource);
 */
class ResourceRecommendationAgent {
  /**
   * Initialize the agent and ChromaDB connection
   */
  async initialize() {
    if (!chromaService.initialized) {
      await chromaService.initialize();
    }
  }

  /**
   * Create text representation of resource for embedding
   * @param {Object} resource - Resource object
   * @returns {String} Text representation
   */
  createResourceText(resource) {
    const parts = [
      `Resource Title: ${resource.title}`,
      `Platform: ${resource.platform}`,
      `Related Skills: ${(resource.relatedSkills || []).join(', ')}`,
      `Cost: ${resource.cost || 'Free'}`,
      `Type: ${resource.type || 'Course'}`,
      resource.description ? `Description: ${resource.description}` : '',
    ];
    return parts.filter(Boolean).join('. ');
  }

  /**
   * Create text representation of user profile for resource matching
   * @param {Object} user - User object
   * @returns {String} Text representation
   */
  createUserText(user) {
    const parts = [
      `Skills: ${(user.skills || []).join(', ')}`,
      `Experience Level: ${user.experienceLevel || 'Fresher'}`,
      `Preferred Career Track: ${user.preferredTrack || ''}`,
      `Career Interests: ${(user.careerInterests || []).join(', ')}`,
      `Education Level: ${user.educationLevel || ''}`,
    ];
    return parts.filter(Boolean).join('. ');
  }

  /**
   * Embed resource into ChromaDB for semantic search
   * @param {Object} resource - Resource object
   * @returns {Boolean} True if successful
   */
  async embedResource(resource) {
    try {
      await this.initialize();
      if (!chromaService.collection) {
        console.warn('⚠️  ChromaDB not available, cannot embed resource');
        return false;
      }

      const resourceText = this.createResourceText(resource);
      
      // Add resource to ChromaDB
      await chromaService.collection.add({
        ids: [`resource_${resource._id}`],
        documents: [resourceText],
        metadatas: [{
          type: 'resource',
          resourceId: resource._id.toString(),
          platform: resource.platform || '',
          cost: resource.cost || 'Free',
        }],
      });

      return true;
    } catch (error) {
      console.warn('Resource embedding warning (non-critical):', error.message);
      return false;
    }
  }

  /**
   * Get intelligent resource recommendations for a user
   * OPTIMIZED: Fast exact matching with optional semantic enhancement
   * 
   * @param {String} userId - User's MongoDB _id
   * @returns {Array} Array of recommended resources with match details
   */
  async getResourceRecommendations(userId) {
    try {
      await this.initialize();

      const user = await User.findById(userId).lean();
      if (!user || !user.skills || user.skills.length === 0) {
        return [];
      }

      // OPTIMIZATION: Limit resources and use lean() for faster queries
      const allResources = await Resource.find()
        .select('title platform cost relatedSkills url type')
        .lean()
        .limit(50); // OPTIMIZATION: Reduced from 100 to 50

      if (allResources.length === 0) {
        return [];
      }

      // OPTIMIZATION: Fast exact matching first (always works, fast)
      const exactMatches = this.getExactMatches(user, allResources);

      // OPTIMIZATION: Convert to recommendations immediately (don't wait for semantic)
      let recommendations = Array.from(exactMatches.entries()).map(([resourceId, match]) => {
        const resource = allResources.find(r => r._id.toString() === resourceId);
        if (!resource) return null;

        return {
          resourceId: resource._id,
          resource,
          matchedItems: match.matchedSkills,
          matchScore: match.matchedSkills.length / (resource.relatedSkills?.length || 1),
          matchType: 'exact',
        };
      }).filter(Boolean);

      // OPTIMIZATION: Enhance with semantic search in parallel (non-blocking)
      if (chromaService.collection && recommendations.length > 0) {
        // Run semantic enhancement in background (don't wait)
        this.enhanceWithSemanticSearch(user, recommendations, allResources)
          .then(enhanced => {
            // Update recommendations with semantic data (async, non-blocking)
            // This happens after response is sent
          })
          .catch(() => {
            // Silently fail - exact matches are already returned
          });
      }

      // OPTIMIZATION: Prioritize and return immediately
      const prioritized = this.prioritizeRecommendations(recommendations, user);

      return prioritized
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20); // Return top 20
    } catch (error) {
      console.error('Resource Recommendation Agent Error:', error);
      // Fallback to simple exact matching
      return this.getFallbackRecommendations(userId);
    }
  }

  /**
   * Enhance recommendations with semantic search (non-blocking)
   * @param {Object} user - User profile
   * @param {Array} recommendations - Current recommendations
   * @param {Array} allResources - All resources
   */
  async enhanceWithSemanticSearch(user, recommendations, allResources) {
    try {
      const userText = this.createUserText(user);
      
      const searchResults = await Promise.race([
        chromaService.collection.query({
          queryTexts: [userText],
          nResults: 15, // OPTIMIZATION: Reduced from 30 to 15
          where: { type: 'resource' },
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 300)) // OPTIMIZATION: Reduced from 500ms to 300ms
      ]);

      if (searchResults?.metadatas?.[0]) {
        const resourceIds = searchResults.metadatas[0]
          .map(meta => meta.resourceId)
          .filter(Boolean);
        const distances = searchResults.distances?.[0] || [];

        // Enhance existing recommendations with semantic similarity
        recommendations.forEach(rec => {
          const index = resourceIds.findIndex(id => id === rec.resourceId.toString());
          if (index !== -1) {
            rec.semanticSimilarity = 1 - (distances[index] || 0.5);
            rec.matchType = 'hybrid';
            // Boost score slightly
            rec.matchScore = (rec.matchScore * 0.7) + (rec.semanticSimilarity * 0.3);
          }
        });
      }
    } catch (error) {
      // Silently fail - exact matches are sufficient
    }
  }

  /**
   * Get exact skill matches between user and resources
   * OPTIMIZED: Fast in-memory matching with Set for O(1) lookups
   * @param {Object} user - User profile
   * @param {Array} resources - All resources
   * @returns {Map} Map of resourceId -> matched skills
   */
  getExactMatches(user, resources) {
    // OPTIMIZATION: Pre-process user items into Set for O(1) lookup
    const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
    const userInterests = (user.careerInterests || []).map(s => s.toLowerCase().trim());
    const allUserItemsSet = new Set([...userSkills, ...userInterests]);
    const allUserItemsArray = [...userSkills, ...userInterests]; // Keep array for substring matching

    const matches = new Map();

    // OPTIMIZATION: Fast iteration with early exit
    resources.forEach(resource => {
      const matchedSkills = (resource.relatedSkills || []).filter(resourceSkill => {
        const resourceSkillLower = resourceSkill.toLowerCase().trim();
        
        // OPTIMIZATION: Check Set first (fastest), then substring matching
        if (allUserItemsSet.has(resourceSkillLower)) {
          return true;
        }
        
        // Substring matching (only if needed)
        return allUserItemsArray.some(userItem => 
          userItem.includes(resourceSkillLower) ||
          resourceSkillLower.includes(userItem)
        );
      });

      if (matchedSkills.length > 0) {
        matches.set(resource._id.toString(), {
          resourceId: resource._id.toString(),
          matchedSkills,
          matchType: 'exact',
        });
      }
    });

    return matches;
  }

  /**
   * Get semantic matches using ChromaDB
   * @param {Object} user - User profile
   * @param {Array} resources - All resources
   * @returns {Array} Array of semantic matches
   */
  async getSemanticMatches(user, resources) {
    try {
      const userText = this.createUserText(user);
      
      // Search for similar resources using semantic search
      const searchResults = await chromaService.collection.query({
        queryTexts: [userText],
        nResults: 30, // Get top 30 semantic matches
        where: { type: 'resource' },
      });

      if (!searchResults.metadatas || !searchResults.metadatas[0]) {
        return [];
      }

      // Extract resource IDs from semantic search
      const resourceIds = searchResults.metadatas[0]
        .map(meta => meta.resourceId)
        .filter(Boolean);

      // Get distances for similarity calculation
      const distances = searchResults.distances?.[0] || [];

      // Map to resource matches
      return resourceIds.map((resourceId, index) => {
        const resource = resources.find(r => r._id.toString() === resourceId);
        if (!resource) return null;

        const similarity = 1 - (distances[index] || 0.5); // Convert distance to similarity

        return {
          resourceId,
          similarity,
          matchType: 'semantic',
          matchedSkills: this.findSemanticMatchedSkills(user, resource),
        };
      }).filter(Boolean);
    } catch (error) {
      console.warn('Semantic matching error:', error.message);
      return [];
    }
  }

  /**
   * Find skills that semantically match between user and resource
   * @param {Object} user - User profile
   * @param {Object} resource - Resource object
   * @returns {Array} Matched skills
   */
  findSemanticMatchedSkills(user, resource) {
    const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
    const resourceSkills = (resource.relatedSkills || []).map(s => s.toLowerCase().trim());

    // Find skills that are similar (substring matching for semantic matches)
    return resourceSkills.filter(resourceSkill => {
      return userSkills.some(userSkill =>
        userSkill.includes(resourceSkill) ||
        resourceSkill.includes(userSkill) ||
        userSkill === resourceSkill
      );
    });
  }

  /**
   * Combine exact and semantic matches, deduplicating
   * @param {Map} exactMatches - Exact matches map
   * @param {Array} semanticMatches - Semantic matches array
   * @param {Array} allResources - All resources
   * @returns {Array} Combined matches
   */
  combineMatches(exactMatches, semanticMatches, allResources) {
    const combined = new Map();

    // Add exact matches
    exactMatches.forEach((match, resourceId) => {
      const resource = allResources.find(r => r._id.toString() === resourceId);
      if (resource) {
        combined.set(resourceId, {
          resource,
          matchedSkills: match.matchedSkills,
          matchType: 'exact',
          matchScore: match.matchedSkills.length / (resource.relatedSkills?.length || 1),
        });
      }
    });

    // Add semantic matches (prioritize if already exists from exact match)
    semanticMatches.forEach(semanticMatch => {
      const resourceId = semanticMatch.resourceId;
      const resource = allResources.find(r => r._id.toString() === resourceId);
      
      if (!resource) return;

      const existing = combined.get(resourceId);
      
      if (existing) {
        // Enhance existing match with semantic similarity
        existing.matchType = 'hybrid';
        existing.semanticSimilarity = semanticMatch.similarity;
        // Boost score with semantic similarity
        existing.matchScore = (existing.matchScore * 0.6) + (semanticMatch.similarity * 0.4);
        // Merge matched skills
        const allMatched = [...new Set([...existing.matchedSkills, ...semanticMatch.matchedSkills])];
        existing.matchedSkills = allMatched;
      } else {
        // New semantic match
        combined.set(resourceId, {
          resource,
          matchedSkills: semanticMatch.matchedSkills,
          matchType: 'semantic',
          semanticSimilarity: semanticMatch.similarity,
          matchScore: semanticMatch.similarity * 0.7, // Slightly lower weight for semantic-only
        });
      }
    });

    return Array.from(combined.values());
  }

  /**
   * Prioritize recommendations based on user profile and context
   * OPTIMIZED: Fast in-memory prioritization
   * @param {Array} recommendations - Recommendations array
   * @param {Object} user - User profile
   * @returns {Array} Prioritized recommendations
   */
  prioritizeRecommendations(recommendations, user) {
    const userTrack = (user.preferredTrack || '').toLowerCase();

    return recommendations.map(rec => {
      let priorityScore = rec.matchScore || 0;

      const resource = rec.resource;
      const resourceTitle = (resource.title || '').toLowerCase();
      const resourcePlatform = (resource.platform || '').toLowerCase();

      // Boost if resource aligns with user's track
      if (userTrack && (
        resourceTitle.includes(userTrack) ||
        resourcePlatform.includes(userTrack) ||
        (rec.matchedItems || []).some(skill => skill.toLowerCase().includes(userTrack))
      )) {
        priorityScore += 0.15;
      }

      // Boost for free resources (accessibility)
      if (resource.cost === 'Free' || resource.cost === 'free') {
        priorityScore += 0.1;
      }

      // Boost for popular platforms
      const popularPlatforms = ['udemy', 'coursera', 'freecodecamp', 'khan academy', 'youtube'];
      if (popularPlatforms.some(platform => resourcePlatform.includes(platform))) {
        priorityScore += 0.05;
      }

      // Boost if semantic similarity is high
      if (rec.semanticSimilarity && rec.semanticSimilarity > 0.8) {
        priorityScore += 0.1;
      }

      return {
        ...rec,
        matchScore: Math.min(priorityScore, 1.0), // Cap at 1.0
        matchPercentage: Math.round(priorityScore * 100),
      };
    });
  }

  /**
   * Fallback recommendations using simple exact matching
   * OPTIMIZED: Fast exact matching with Set-based lookups
   * @param {String} userId - User ID
   * @returns {Array} Basic recommendations
   */
  async getFallbackRecommendations(userId) {
    try {
      const user = await User.findById(userId).lean();
      if (!user) return [];

      // OPTIMIZATION: Pre-process into Set for O(1) lookups
      const userSkills = (user.skills || []).map(s => s.toLowerCase().trim());
      const userInterests = (user.careerInterests || []).map(s => s.toLowerCase().trim());
      const allUserItemsSet = new Set([...userSkills, ...userInterests]);
      const allUserItemsArray = [...userSkills, ...userInterests];

      // OPTIMIZATION: Limit and use lean()
      const resources = await Resource.find()
        .select('title platform cost relatedSkills url type')
        .lean()
        .limit(50);

      return resources
        .map(resource => {
          const matchedItems = (resource.relatedSkills || []).filter(resourceSkill => {
            const resourceSkillLower = resourceSkill.toLowerCase().trim();
            
            // OPTIMIZATION: Set lookup first (fastest)
            if (allUserItemsSet.has(resourceSkillLower)) {
              return true;
            }
            
            // Substring matching (only if needed)
            return allUserItemsArray.some(userItem => 
              userItem.includes(resourceSkillLower) ||
              resourceSkillLower.includes(userItem)
            );
          });

          if (matchedItems.length > 0) {
            return {
              resourceId: resource._id,
              resource,
              matchedItems,
              matchScore: matchedItems.length / (resource.relatedSkills?.length || 1),
              matchPercentage: Math.round((matchedItems.length / (resource.relatedSkills?.length || 1)) * 100),
              matchType: 'exact',
            };
          }

          return null;
        })
        .filter(Boolean)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, 20);
    } catch (error) {
      console.error('Fallback recommendations error:', error);
      return [];
    }
  }

  /**
   * Batch embed all resources into ChromaDB
   * Useful for initial setup or periodic updates
   * @param {Number} limit - Maximum number of resources to embed (optional)
   * @returns {Object} Embedding statistics
   */
  async embedAllResources(limit = null) {
    try {
      await this.initialize();
      
      if (!chromaService.collection) {
        return { success: false, message: 'ChromaDB not available' };
      }

      const query = Resource.find().select('title platform cost relatedSkills url type description');
      if (limit) {
        query.limit(limit);
      }
      
      const resources = await query.lean();
      
      let embedded = 0;
      let failed = 0;

      for (const resource of resources) {
        try {
          const success = await this.embedResource(resource);
          if (success) {
            embedded++;
          } else {
            failed++;
          }
        } catch (error) {
          console.warn(`Failed to embed resource ${resource._id}:`, error.message);
          failed++;
        }
      }

      return {
        success: true,
        total: resources.length,
        embedded,
        failed,
        message: `Embedded ${embedded} out of ${resources.length} resources`,
      };
    } catch (error) {
      console.error('Batch embedding error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

module.exports = new ResourceRecommendationAgent();

