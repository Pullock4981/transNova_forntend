require('dotenv').config();
const { CloudClient } = require('chromadb');

async function testChromaDBCloud() {
  console.log('========================================');
  console.log('🧪 Testing ChromaDB Cloud Connection');
  console.log('========================================\n');

  const apiKey = process.env.CHROMA_API_KEY || 'ck-CVZY4QeuzotW3nP19M3FjF7cBk5KSSB12V3pxx2Kvr6g';
  const tenant = process.env.CHROMA_TENANT || '298d6e96-9463-4a9f-8569-b8c5bfb38c88';
  const database = process.env.CHROMA_DATABASE || 'hackathon';

  console.log('📋 Configuration:');
  console.log(`   API Key: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`);
  console.log(`   Tenant: ${tenant}`);
  console.log(`   Database: ${database}\n`);

  try {
    console.log('🔌 Step 1: Creating CloudClient...');
    const client = new CloudClient({
      apiKey: apiKey,
      tenant: tenant,
      database: database,
    });
    console.log('✅ CloudClient created\n');

    console.log('🔌 Step 2: Creating/getting test collection...');
    const testCollection = await client.getOrCreateCollection({
      name: 'test',
    });
    console.log('✅ Test collection ready\n');

    console.log('🔌 Step 3: Adding test data...');
    await testCollection.add({
      ids: ['test_1'],
      documents: ['This is a test document for Chroma Cloud.'],
      metadatas: [{ type: 'test' }],
    });
    console.log('✅ Data uploaded successfully!\n');

    console.log('🔌 Step 4: Querying test data...');
    const results = await testCollection.query({
      queryTexts: ['test'],
      nResults: 1,
    });
    console.log('✅ Query successful');
    console.log(`   Found ${results.ids[0]?.length || 0} results\n`);

    console.log('🔌 Step 5: Testing production collection (skills_jobs)...');
    const productionCollection = await client.getOrCreateCollection({
      name: 'skills_jobs',
      metadata: { description: 'Skills and job embeddings for semantic search' },
    });
    console.log('✅ Production collection ready\n');

    console.log('🔌 Step 6: Cleaning up test data...');
    await testCollection.delete({ ids: ['test_1'] });
    console.log('✅ Test data cleaned up\n');

    console.log('========================================');
    console.log('🎉 CHROMADB CLOUD CONNECTION TEST PASSED!');
    console.log('========================================');
    console.log('✅ All operations working correctly');
    console.log('✅ ChromaDB Cloud is ready to use');
    console.log('✅ Production collection (skills_jobs) is ready');
    console.log('========================================\n');

    return { success: true };

  } catch (error) {
    console.error('\n❌ CHROMADB CLOUD CONNECTION TEST FAILED!');
    console.error('========================================');
    console.error('Error Details:');
    console.error(`   Message: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Type: ${error.constructor.name}`);
    
    if (error.message?.includes('401') || error.message?.includes('Unauthorized')) {
      console.error('\n⚠️  Authentication Failed');
      console.error('   Possible causes:');
      console.error('   - Invalid API key');
      console.error('   - API key expired');
      console.error('   - Wrong tenant/database');
    } else if (error.message?.includes('404')) {
      console.error('\n⚠️  Resource Not Found');
      console.error('   Possible causes:');
      console.error('   - Invalid tenant ID');
      console.error('   - Invalid database name');
      console.error('   - Database does not exist');
    } else {
      console.error('\n⚠️  Error Details:');
      console.error('   Full error:', error);
      if (error.stack) {
        console.error('   Stack trace:', error.stack.substring(0, 500));
      }
    }
    
    console.error('========================================\n');
    process.exit(1);
  }
}

testChromaDBCloud().catch(console.error);

