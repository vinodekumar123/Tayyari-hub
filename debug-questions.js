
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

const COURSE_ID = '7CRr7Duoo7LFRW7ZhiMk';

async function listQuestions() {
    console.log(`Fetching questions for Course ID: ${COURSE_ID} ...`);
    try {
        const qSnap = await db.collection('questions')
            .where('courseId', '==', COURSE_ID)
            .limit(10)
            .get();

        console.log(`Found ${qSnap.size} documents.`);

        if (qSnap.empty) {
            // Double check if using 'course' instead of 'courseId'
            console.log("Checking alternative field 'course'...");
            const qSnapAlt = await db.collection('questions')
                .where('course', '==', COURSE_ID)
                .limit(10)
                .get();
            console.log(`Found ${qSnapAlt.size} documents with 'course' field.`);
        }

        qSnap.forEach(doc => {
            const d = doc.data();
            console.log(`\nID: ${doc.id}`);
            console.log(` - Subject: "${d.subject}" (Type: ${typeof d.subject})`);
            console.log(` - CourseID: "${d.courseId}"`);
            console.log(` - Fields: ${Object.keys(d).join(', ')}`);
        });

    } catch (error) {
        console.error("Error:", error);
    }
}

listQuestions();
