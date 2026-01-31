# Firestore Vector Index Setup for AI Tutor

This document explains how to set up the required Firestore vector index for the AI Tutor RAG system.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Logged into Firebase CLI (`firebase login`)
- Access to your Tayyari Hub Firebase project

## Important: Vector Indexes Cannot Be Created via Console UI

> [!IMPORTANT]
> Firestore **vector indexes** must be created using the Firebase CLI or gcloud commands - they are NOT available in the Firebase Console's normal "Add Index" UI.

---

## Method 1: Firebase CLI (Recommended)

### Step 1: Create firestore.indexes.json

Create a file called `firestore.indexes.json` in your project root:

```json
{
  "indexes": [
    {
      "collectionGroup": "knowledge_base",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "embedding",
          "vectorConfig": {
            "dimension": 768,
            "flat": {}
          }
        }
      ]
    },
    {
      "collectionGroup": "knowledge_base",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "metadata.type",
          "order": "ASCENDING"
        },
        {
          "fieldPath": "embedding",
          "vectorConfig": {
            "dimension": 768,
            "flat": {}
          }
        }
      ]
    },
    {
      "collectionGroup": "knowledge_base",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "metadata.uploadedAt",
          "order": "DESCENDING"
        }
      ]
    }
  ],
  "fieldOverrides": []
}
```

### Step 2: Deploy the Indexes

```bash
# Make sure you're in your project directory
cd c:\Users\ntceh\Desktop\tayyarihub\Tayyari-hub

# Login if not already
firebase login

# Set your project (replace with your actual project ID)
firebase use YOUR_PROJECT_ID

# Deploy indexes only
firebase deploy --only firestore:indexes
```

### Step 3: Wait for Index to Build

- Index creation can take 5-15 minutes
- Check status in Firebase Console → Firestore → Indexes tab
- Status will change from "Building..." to "Enabled"

---

## Method 2: gcloud CLI

If you prefer using gcloud directly:

```bash
# Install gcloud CLI if not installed
# https://cloud.google.com/sdk/docs/install

# Login
gcloud auth login

# Set project
gcloud config set project YOUR_PROJECT_ID

# Create the vector index
gcloud firestore indexes composite create \
  --collection-group=knowledge_base \
  --query-scope=COLLECTION \
  --field-config=field-path=embedding,vector-config='{"dimension":"768","flat":{}}' \
  --database="(default)"
```

---

## Method 3: Auto-Create from Error Link

When you first run the AI Tutor:

1. Open `/admin/ai-tutor-test` and ask a question
2. Check the browser console (F12 → Console)
3. Look for an error message containing a Firebase link
4. Click the link - it will auto-create the required index

---

## Troubleshooting

### Error: "The query requires an index"
- The vector index hasn't been created yet
- Use Method 1 or 2 above to create it
- Or look for an auto-create link in the error

### Error: "Index build failed"
- Check that no documents have malformed embeddings
- Ensure all embeddings are exactly 768 dimensions
- Try deleting the partial index and re-creating

### Vector Search Not Returning Results
- Verify documents exist in `knowledge_base` collection
- Check Firebase Console to confirm embeddings are stored
- Ensure embedding field contains a 768-element array

---

## Testing the Setup

1. Upload a test document at `/admin/knowledge-base`
2. Verify it appears at `/admin/knowledge-base/manage`
3. Ask a related question at `/admin/ai-tutor-test`
4. If you get relevant context in the response, RAG is working!

---

## Technical Notes

- Embedding model: `text-embedding-004` (768 dimensions)
- Distance measure: Cosine similarity
- Retrieves: Top 3 books + Top 1 syllabus per query
