# Environment Variables Setup

## Required Environment Variables

Add these to your `SDG-8/.env` file:

```env
# MongoDB Connection
MONGO_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d

# Gemini AI (Required for Part 2)
GEMINI_API_KEY=your_gemini_api_key_here

# ChromaDB Cloud (Optional - defaults provided)
CHROMA_API_KEY=ck-9M44Hp1zskNDFvAE9fLrGyHnTdkseX7cZDuFgAD9VkeB
CHROMA_TENANT=298d6e96-9463-4a9f-8569-b8c5bfb38c88
CHROMA_DATABASE=transnova

# Server
NODE_ENV=development
PORT=5000
```

## Getting Your Gemini API Key

1. Go to: https://makersuite.google.com/app/apikey
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to `.env` as `GEMINI_API_KEY`

## ChromaDB Cloud

The ChromaDB credentials are already configured with defaults:
- API Key: `ck-9M44Hp1zskNDFvAE9fLrGyHnTdkseX7cZDuFgAD9VkeB`
- Tenant: `298d6e96-9463-4a9f-8569-b8c5bfb38c88`
- Database: `transnova`

You can override these in `.env` if needed.

## Testing

After setting up environment variables, test the connection:

```bash
# Test server
npm run dev

# Test AI endpoint (requires authentication)
curl -X POST http://localhost:5000/api/ai/extract-cv \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"cvText": "Test CV content..."}'
```

