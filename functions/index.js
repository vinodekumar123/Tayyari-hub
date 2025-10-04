const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

const TOP_N = 10; // leaderboard size

exports.updateLeaderboardOnQuizSubmit = functions.firestore
  .document('users/{userId}/quizAttempts/{attemptId}')
  .onWrite(async (change, context) => {
    const { userId } = context.params;

    // 1. Recalculate accuracy for this user
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
    // 2. Update user's accuracy
    await admin.firestore().collection('users').doc(userId).update({
      leaderboardAccuracy: accuracy
    });

    // 3. Fetch all users' accuracy for leaderboard
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

    // 4. Sort and update leaderboard/top doc
    leaderboard.sort((a, b) => b.accuracy - a.accuracy);
    const topN = leaderboard.slice(0, TOP_N);
    await admin.firestore().collection('leaderboard').doc('top').set({
      users: topN,
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // 5. (Optional) Update leaderboardRank in user docs for top N only
    for (let i = 0; i < topN.length; i++) {
      await admin.firestore().collection('users').doc(topN[i].userId).update({
        leaderboardRank: i + 1
      });
    }
    // (Optionally, clear leaderboardRank for users not in topN if you want)

    return null;
  });
