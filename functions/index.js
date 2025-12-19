const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const TOP_N = 10;

// 1. HTTP function for one-time initial setup
exports.generateInitialLeaderboard = functions.https.onRequest(async (req, res) => {
  try {
    const usersSnap = await admin.firestore().collection('users').get();
    const leaderboard = [];

    for (const userDoc of usersSnap.docs) {
      const userId = userDoc.id;
      const attemptsSnap = await admin.firestore()
        .collection('users').doc(userId)
        .collection('quizAttempts').get();

      let attempted = 0, correct = 0;
      for (const attemptDoc of attemptsSnap.docs) {
        const resultSnap = await admin.firestore()
          .collection('users').doc(userId)
          .collection('quizAttempts').doc(attemptDoc.id)
          .collection('results').doc(attemptDoc.id).get();
        const quizSnap = await admin.firestore()
          .collection('quizzes').doc(attemptDoc.id).get();
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
      leaderboard.push({
        userId,
        accuracy,
        name: userDoc.data().fullName || 'Anonymous'
      });
    }
    leaderboard.sort((a, b) => b.accuracy - a.accuracy);
    const topN = leaderboard.slice(0, TOP_N);
    await admin.firestore().collection('leaderboard').doc('top').set({
      users: topN,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });
    for (let i = 0; i < topN.length; i++) {
      await admin.firestore().collection('users').doc(topN[i].userId).update({
        leaderboardRank: i + 1
      });
    }
    res.status(200).send('Initial leaderboard and accuracy fields created.');
  } catch (err) {
    console.error('Error generating leaderboard:', err);
    res.status(500).send('Error generating leaderboard');
  }
});

// 2. Trigger function for ongoing updates
exports.updateLeaderboardOnQuizSubmit = functions.firestore
  .document('users/{userId}/quizAttempts/{attemptId}')
  .onWrite(async (change, context) => {
    const { userId } = context.params;

    const attemptsSnap = await admin.firestore()
      .collection('users').doc(userId)
      .collection('quizAttempts').get();
    let attempted = 0, correct = 0;
    for (const attemptDoc of attemptsSnap.docs) {
      const resultSnap = await admin.firestore()
        .collection('users').doc(userId)
        .collection('quizAttempts').doc(attemptDoc.id)
        .collection('results').doc(attemptDoc.id).get();
      const quizSnap = await admin.firestore()
        .collection('quizzes').doc(attemptDoc.id).get();
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
    for (let i = 0; i < topN.length; i++) {
      await admin.firestore().collection('users').doc(topN[i].userId).update({
        leaderboardRank: i + 1
      });
    }
    return null;
  });
