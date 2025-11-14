const { ChromaClient } = require('chromadb');

class ChromaService {
  constructor() {
    this.client = null;
    this.collection = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Connect to ChromaDB Cloud
      const apiKey = process.env.CHROMA_API_KEY || 'ck-9M44Hp1zskNDFvAE9fLrGyHnTdkseX7cZDuFgAD9VkeB';
      const tenant = process.env.CHROMA_TENANT || '298d6e96-9463-4a9f-8569-b8c5bfb38c88';
      const database = process.env.CHROMA_DATABASE || 'transnova';
      
      this.client = new ChromaClient({
        path: `https://${tenant}.chromadb.cloud`,
        auth: {
          provider: 'token',
          credentials: apiKey,
        },
        tenant: tenant,
        database: database,
      });

      // Get or create collection for skills/jobs
      try {
        this.collection = await this.client.getOrCreateCollection({
          name: 'skills_jobs',
          metadata: { description: 'Skills and job embeddings for semantic search' },
        });
      } catch (error) {
        // If collection creation fails, ChromaDB is not available
        // Don't log connection errors - they're expected if ChromaDB is down
        if (!error.message?.includes('ENOTFOUND') && !error.message?.includes('Failed to connect')) {
          console.warn('ChromaDB collection warning:', error.message);
        }
        throw error; // Re-throw to be caught by outer try-catch
      }

      this.initialized = true;
      console.log('✅ ChromaDB Cloud connected');
    } catch (error) {
      // Silently fail - we'll use exact matching instead
      // Only log if it's not a connection error (to reduce noise)
      if (!error.message?.includes('ENOTFOUND') && !error.message?.includes('Failed to connect')) {
        console.warn('ChromaDB initialization warning:', error.message);
      }
      // Continue without ChromaDB (graceful degradation)
      this.initialized = false;
    }
  }

  async addSkills(skills, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.collection) return;

    try {
      const ids = skills.map((_, i) => `skill_${Date.now()}_${i}`);
      const documents = skills;
      const metadatas = skills.map(skill => ({
        type: 'skill',
        skill: skill.toLowerCase(),
        ...metadata,
      }));

      await this.collection.add({
        ids,
        documents,
        metadatas,
      });

      return ids;
    } catch (error) {
      console.error('ChromaDB add skills error:', error);
      return [];
    }
  }

  async searchSimilarSkills(query, nResults = 5) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.collection) return [];

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults,
      });

      if (results.documents && results.documents[0]) {
        return results.documents[0].map((doc, i) => ({
          skill: doc,
          distance: results.distances?.[0]?.[i] || 0,
          metadata: results.metadatas?.[0]?.[i] || {},
        }));
      }
      return [];
    } catch (error) {
      console.error('ChromaDB search error:', error);
      return [];
    }
  }

  async addJob(jobId, title, requiredSkills, metadata = {}) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.collection) return;

    try {
      const document = `${title} ${requiredSkills.join(' ')}`;
      await this.collection.add({
        ids: [`job_${jobId}`],
        documents: [document],
        metadatas: [{
          type: 'job',
          jobId: jobId.toString(),
          title,
          skills: requiredSkills.join(','),
          ...metadata,
        }],
      });
    } catch (error) {
      console.error('ChromaDB add job error:', error);
    }
  }

  async searchSimilarJobs(query, nResults = 10) {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.collection) return [];

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults,
        where: { type: 'job' },
      });

      if (results.metadatas && results.metadatas[0]) {
        return results.metadatas[0].map((meta, i) => ({
          jobId: meta.jobId,
          title: meta.title,
          skills: meta.skills ? meta.skills.split(',') : [],
          distance: results.distances?.[0]?.[i] || 0,
        }));
      }
      return [];
    } catch (error) {
      console.error('ChromaDB job search error:', error);
      return [];
    }
  }
}

module.exports = new ChromaService();

