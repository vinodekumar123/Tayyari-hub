const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const TOP_N = 10;
const BATCH_SIZE = 10; // Number of users processed per HTTP request

// Helper to compute accuracy for a user
async function computeUserAccuracy(userId) {
  const attemptsSnap = await admin.firestore()
    .collection('users').doc(userId)
    .collection('quizAttempts').get();

  // Gather all result and quiz docs in parallel (for each attempt)
  const attemptData = await Promise.all(attemptsSnap.docs.map(async (attemptDoc) => {
    const resultRef = admin.firestore()
      .collection('users').doc(userId)
      .collection('quizAttempts').doc(attemptDoc.id)
      .collection('results').doc(attemptDoc.id);
    const quizRef = admin.firestore()
      .collection('quizzes').doc(attemptDoc.id);
    const [resultSnap, quizSnap] = await Promise.all([resultRef.get(), quizRef.get()]);
    return { resultSnap, quizSnap };
  }));

  let attempted = 0, correct = 0;
  for (const { resultSnap, quizSnap } of attemptData) {
    if (!resultSnap.exists || !quizSnap.exists) continue;
    const resultData = resultSnap.data();
    const selectedQuestions = quizSnap.data().selectedQuestions || [];
    const answers = resultData.answers || {};
    for (const q of selectedQuestions.slice(0, 10)) {
      if (!q.id) continue;
      attempted++;
      const userAns = (answers[q.id] || '').trim().toLowerCase();
      const correctAns = (q.correctAnswer || '').trim().toLowerCase();
      if (userAns && userAns === correctAns) correct++;
    }
  }
  const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
  await admin.firestore().collection('users').doc(userId).update({
    leaderboardAccuracy: accuracy
  });
  return accuracy;
}

// HTTP function for one-time initial setup (batch processing)
exports.generateInitialLeaderboard = functions.https.onRequest(async (req, res) => {
  try {
    req.setTimeout && req.setTimeout(540000);

    // For batching: use ?startAfter=USER_ID to continue
    const startAfter = req.query.startAfter || null;
    let usersQuery = admin.firestore().collection('users')
      .orderBy(admin.firestore.FieldPath.documentId()).limit(BATCH_SIZE);
    if (startAfter) {
      usersQuery = usersQuery.startAfter(startAfter);
    }
    const usersSnap = await usersQuery.get();

    if (usersSnap.empty) {
      res.status(200).send('No more users to process. All batches completed.');
      return;
    }

    // Compute accuracy for this batch of users
    const leaderboard = [];
    await Promise.all(usersSnap.docs.map(async (userDoc) => {
      const userId = userDoc.id;
      const accuracy = await computeUserAccuracy(userId);
      leaderboard.push({
        userId,
        accuracy,
        name: userDoc.data().fullName || 'Anonymous'
      });
    }));

    // Update the leaderboard/top with current (partial) leaderboard
    // Fetch all users' accuracy for a true top N after all batches, but here we update only for immediate batch
    // Optionally: on last batch, aggregate all users for true top N

    // Provide a pointer for next batch
    const lastUserId = usersSnap.docs[usersSnap.docs.length - 1].id;
    res.status(200).send(`Processed ${usersSnap.docs.length} users. Next batch: ?startAfter=${lastUserId}`);
  } catch (err) {
    console.error('Error generating leaderboard batch:', err);
    res.status(500).send('Error generating leaderboard batch');
  }
});

// Separate endpoint to finalize leaderboard ranking after all batches are done
exports.finalizeLeaderboard = functions.https.onRequest(async (req, res) => {
  try {
    const usersSnap = await admin.firestore().collection('users').get();
    const leaderboard = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      leaderboard.push({
        userId: doc.id,
        accuracy: data.leaderboardAccuracy || 0,
        name: data.fullName || 'Anonymous'
      });
    });
    leaderboard.sort((a, b) => b.accuracy - a.accuracy);
    const topN = leaderboard.slice(0, TOP_N);

    // Write to leaderboard/top
    await admin.firestore().collection('leaderboard').doc('top').set({
      users: topN,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update rank for top N users
    await Promise.all(topN.map((entry, i) => {
      return admin.firestore().collection('users').doc(entry.userId).update({
        leaderboardRank: i + 1
      });
    }));

    res.status(200).send('Leaderboard finalized and ranks assigned.');
  } catch (err) {
    console.error('Error finalizing leaderboard:', err);
    res.status(500).send('Error finalizing leaderboard');
  }
});

// Trigger function for ongoing updates
exports.updateLeaderboardOnQuizSubmit = functions.firestore
  .document('users/{userId}/quizAttempts/{attemptId}')
  .onWrite(async (change, context) => {
    const { userId } = context.params;

    // Recompute accuracy for this user
    const accuracy = await computeUserAccuracy(userId);

    // Update leaderboard/top
    const usersSnap = await admin.firestore().collection('users').get();
    const leaderboard = [];
    usersSnap.forEach(doc => {
      const data = doc.data();
      leaderboard.push({
        userId: doc.id,
        accuracy: data.leaderboardAccuracy || 0,
        name: data.fullName || 'Anonymous'
      });
    });
    leaderboard.sort((a, b) => b.accuracy - a.accuracy);
    const topN = leaderboard.slice(0, TOP_N);
    await admin.firestore().collection('leaderboard').doc('top').set({
      users: topN,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    await Promise.all(topN.map((entry, i) => {
      return admin.firestore().collection('users').doc(entry.userId).update({
        leaderboardRank: i + 1
      });
    }));
    return null;
  });