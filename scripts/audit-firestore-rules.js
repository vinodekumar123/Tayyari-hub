const fs = require('fs');
const path = require('path');

const rulesPath = path.join(__dirname, '..', 'firestore.rules');

try {
    if (!fs.existsSync(rulesPath)) {
        console.error('❌ firestore.rules not found!');
        process.exit(1);
    }

    const content = fs.readFileSync(rulesPath, 'utf8');

    // Check for "allow read, write: if request.auth != null" (simplistic check)
    // More robust check would parse, but this catches the lazy "all open" rule.
    const insecurePatterns = [
        /allow\s+read,\s*write:\s*if\s+request\.auth\s*!=\s*null/g,
        /allow\s+read,\s*write:\s*if\s+true/g,
        /allow\s+write:\s*if\s+true/g
    ];

    let hasError = false;

    insecurePatterns.forEach(pattern => {
        if (pattern.test(content)) {
            console.error(`❌ Insecure rule pattern found: ${pattern}`);
            hasError = true;
        }
    });

    if (hasError) {
        console.error('FAILURE: Insecure Firestore rules detected.');
        process.exit(1);
    }

    console.log('✅ Firestore rules audit passed (no obvious "allow all" patterns).');
} catch (err) {
    console.error('Error reading rules file:', err);
    process.exit(1);
}
