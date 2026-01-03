const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DRY_RUN = !process.argv.includes('--execute');

async function initFirebase() {
  const credPath = path.join(process.cwd(), 'temp-service-account.json');
  if (!fs.existsSync(credPath)) {
    console.error('Service account file not found:', credPath);
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(credPath),
  });
}

async function main() {
  await initFirebase();
  const db = admin.firestore();

  const args = process.argv.slice(2);
  const excludeArg = args.find(a => a.startsWith('--exclude='));
  const EXCLUDED_EMAILS = ['vinodenarain@gmail.com', 'adeebnarain@gmail.com'];
  if (excludeArg) {
    const extra = excludeArg.split('=')[1].split(',').map(s => s.trim()).filter(Boolean);
    EXCLUDED_EMAILS.push(...extra);
  }

  console.log('Excluded emails:', EXCLUDED_EMAILS.join(', '));

  const usersCol = db.collection('users');
  console.log('Fetching documents from `users` collection...');
  const snapshot = await usersCol.get();
  console.log(`Found ${snapshot.size} user documents.`);

  const toDelete = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    const email = (data && data.email) || null;
    if (!email || !EXCLUDED_EMAILS.includes(email)) {
      toDelete.push({ id: doc.id, email });
    }
  });

  console.log(`Candidates to delete: ${toDelete.length}`);
  if (toDelete.length > 0) {
    console.log('[DRY RUN] Listing first 500 candidates:');
    toDelete.slice(0, 500).forEach(u => console.log(` - ${u.email || '<no-email>'} (${u.id})`));
  }

  if (DRY_RUN) {
    console.log('\nDRY RUN mode; no documents were changed. Run with --execute to delete.');
    return;
  }

  console.log('\nDeleting documents in batches...');
  const BATCH_SIZE = 500;
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = toDelete.slice(i, i + BATCH_SIZE);
    slice.forEach(u => batch.delete(usersCol.doc(u.id)));
    await batch.commit();
    console.log(`  Batch ${i / BATCH_SIZE + 1}: deleted ${slice.length}`);
  }

  console.log('Deletion complete.');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
