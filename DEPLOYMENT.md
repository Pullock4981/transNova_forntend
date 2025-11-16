# Vercel Deployment Guide

This guide will help you deploy the SDG-8 backend to Vercel.

## Prerequisites

1. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
2. **GitHub/GitLab/Bitbucket Account** - Your code should be in a Git repository
3. **MongoDB Atlas** - Cloud MongoDB instance (recommended for production)
4. **Environment Variables** - All required API keys and secrets

## Step 1: Prepare Your Repository

Ensure your code is pushed to a Git repository (GitHub, GitLab, or Bitbucket).

## Step 2: Install Vercel CLI (Optional)

```bash
npm install -g vercel
```

## Step 3: Configure Environment Variables

Before deploying, you need to set up all environment variables in Vercel:

### Required Environment Variables

1. **MongoDB Connection**
   ```
   MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
   ```

2. **JWT Authentication**
   ```
   JWT_SECRET=your-super-secret-jwt-key-min-32-characters
   JWT_EXPIRE=30d
   ```

3. **AI Service (Choose one)**
   ```
   OPENROUTER_API_KEY=your_openrouter_api_key
   # OR
   OPENAI_API_KEY=your_openai_api_key
   ```

4. **ChromaDB (Optional - defaults provided)**
   ```
   CHROMA_API_KEY=ck-9M44Hp1zskNDFvAE9fLrGyHnTdkseX7cZDuFgAD9VkeB
   CHROMA_TENANT=298d6e96-9463-4a9f-8569-b8c5bfb38c88
   CHROMA_DATABASE=transnova
   ```

5. **Email Service (If using email features)**
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASSWORD=your-app-specific-password
   EMAIL_FROM=your-email@gmail.com
   ```

6. **Server Configuration**
   ```
   NODE_ENV=production
   PORT=5000
   ```

## Step 4: Deploy via Vercel Dashboard

### Method 1: Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click **"New Project"**
3. Import your Git repository
4. Configure the project:
   - **Framework Preset:** Other
   - **Root Directory:** `SDG-8` (if your backend is in a subdirectory)
   - **Build Command:** Leave empty (no build needed)
   - **Output Directory:** Leave empty
   - **Install Command:** `npm install --legacy-peer-deps`
5. Add all environment variables (from Step 3)
6. Click **"Deploy"**

### Method 2: Vercel CLI

1. Navigate to your project directory:
   ```bash
   cd SDG-8
   ```

2. Login to Vercel:
   ```bash
   vercel login
   ```

3. Deploy:
   ```bash
   vercel
   ```

4. Follow the prompts:
   - Set up and deploy? **Yes**
   - Which scope? Select your account
   - Link to existing project? **No** (for first deployment)
   - Project name: `sdg-8-backend` (or your preferred name)
   - Directory: `./` (current directory)
   - Override settings? **No**

5. Add environment variables:
   ```bash
   vercel env add MONGO_URI
   vercel env add JWT_SECRET
   vercel env add OPENROUTER_API_KEY
   # ... add all other variables
   ```

6. Deploy to production:
   ```bash
   vercel --prod
   ```

## Step 5: Verify Deployment

1. Check the deployment URL (provided by Vercel)
2. Test the health endpoint:
   ```bash
   curl https://your-project.vercel.app/health
   ```
   Expected response:
   ```json
   {
     "success": true,
     "message": "Server is running",
     "timestamp": "2024-..."
   }
   ```

3. Test an API endpoint:
   ```bash
   curl https://your-project.vercel.app/api/jobs
   ```

## Step 6: Update Frontend API Base URL

Update your frontend `.env` file to point to the Vercel deployment:

```env
VITE_API_BASE_URL=https://your-project.vercel.app
```

## Important Notes

### 1. Function Timeout
- Default timeout: 10 seconds
- Maximum timeout: 60 seconds (configured in `vercel.json`)
- For long-running operations, consider using background jobs

### 2. Database Connection
- MongoDB connections are reused across function invocations
- Connection pooling is handled automatically
- Ensure your MongoDB Atlas IP whitelist includes Vercel's IP ranges (or allow all IPs: `0.0.0.0/0`)

### 3. File Uploads
- Vercel has a 4.5MB request body limit
- For larger files, consider using external storage (S3, Cloudinary, etc.)

### 4. Environment Variables
- Add all environment variables in Vercel dashboard
- Variables are encrypted and secure
- Use different values for Production, Preview, and Development environments

## Troubleshooting

### Issue: "Module not found"
**Solution:** Ensure `package.json` includes all dependencies and run `npm install --legacy-peer-deps`

### Issue: "MongoDB connection timeout"
**Solution:** 
- Check MongoDB Atlas IP whitelist
- Verify `MONGO_URI` is correct
- Ensure MongoDB cluster is running

### Issue: "Function timeout"
**Solution:**
- Increase timeout in `vercel.json` (max 60 seconds)
- Optimize long-running operations
- Consider breaking into smaller functions

### Issue: "ChromaDB connection error"
**Solution:**
- Verify ChromaDB credentials
- Check network connectivity
- ChromaDB has default credentials configured

### Issue: "AI API key invalid"
**Solution:**
- Verify API key is correct
- Check API key has sufficient credits/quota
- Ensure environment variable name matches exactly

## Monitoring

1. **Vercel Dashboard** - View logs, analytics, and function metrics
2. **Function Logs** - Check real-time logs in Vercel dashboard
3. **Analytics** - Monitor API usage and performance

## Continuous Deployment

Vercel automatically deploys on every push to your main branch:
- **Production:** Deploys from `main`/`master` branch
- **Preview:** Deploys from other branches and pull requests

## Custom Domain

1. Go to Project Settings → Domains
2. Add your custom domain
3. Configure DNS records as instructed
4. SSL certificate is automatically provisioned

## Rollback

If a deployment fails:
1. Go to Deployments in Vercel dashboard
2. Find the previous working deployment
3. Click "..." → "Promote to Production"

## Support

For issues:
- Check Vercel documentation: [vercel.com/docs](https://vercel.com/docs)
- Check function logs in Vercel dashboard
- Review error messages in deployment logs

---

**Deployment URL Format:**
- Production: `https://your-project.vercel.app`
- Preview: `https://your-project-git-branch.vercel.app`

