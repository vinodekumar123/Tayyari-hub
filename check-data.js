
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkData() {
    console.log("Checking Firestore Data...");
    try {
        // 1. Get Courses
        const coursesSnap = await db.collection('courses').get();
        console.log(`Found ${coursesSnap.size} courses.`);

        if (coursesSnap.empty) {
            console.log("No courses found. Exiting.");
            return;
        }

        const courses = [];
        coursesSnap.forEach(doc => courses.push({ id: doc.id, ...doc.data() }));

        // 2. Get Subjects
        const subSnap = await db.collection('subjects').get();
        console.log(`Found ${subSnap.size} subjects.`);
        const subjects = [];
        subSnap.forEach(doc => subjects.push({ id: doc.id, ...doc.data() }));

        // 3. Check Questions for first valid combination
        for (const course of courses) {
            for (const subject of subjects) {
                // Check if subject belongs to course (logic from frontend)
                if (course.subjectIds && course.subjectIds.includes(subject.id)) {
                    console.log(`\nChecking Course: "${course.name}" (${course.id}) + Subject: "${subject.name}"`);

                    const qSnap = await db.collection('questions')
                        .where('courseId', '==', course.id)
                        .where('subject', '==', subject.name)
                        .limit(5)
                        .get();

                    console.log(` -> Found ${qSnap.size} sample questions.`);
                    if (!qSnap.empty) {
                        console.log(" Sample Question ID:", qSnap.docs[0].id);
                        console.log(" Sample Data:", JSON.stringify(qSnap.docs[0].data(), null, 2));
                        return; // Found valid data, exit
                    }
                }
            }
        }
        console.log("\nNo matching questions found for any mapped Course+Subject.");

    } catch (error) {
        console.error("Error:", error);
    }
}

checkData();
