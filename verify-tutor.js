import { scrubPII } from './lib/privacyUtils';
import { detectSubject, classifyQueryIntent } from './lib/ai-cache';

function testPII() {
    console.log('--- Testing PII Scrubbing ---');
    const testCases = [
        { name: 'Email', text: 'Contact me at test@example.com' },
        { name: 'Phone', text: 'Call me at 0300-1234567' },
        { name: 'Support Phone (Keep)', text: 'Support is at 03237507673' },
        { name: 'ID (CNIC)', text: 'My ID is 42101-1234567-1' },
    ];

    testCases.forEach(tc => {
        const result = scrubPII(tc.text);
        console.log(`[${tc.name}] Input: ${tc.text} -> Output: ${result}`);
    });
}

function testLogic() {
    console.log('\n--- Testing Subject & Intent Detection ---');
    const testCases = [
        { q: 'What is DNA replication?', expectedSubject: 'Biology', expectedIntent: 'factual' },
        { q: 'Explain photosynthesis simply like I am 5', expectedIntent: 'remedial' },
        { q: 'Compare mitosis and meiosis in a table', expectedIntent: 'visual' },
        { q: 'Molecular mechanism of ATP synthesis', expectedIntent: 'advanced' },
        { q: 'Which cells cause cancer?', expectedSubject: 'Biology' }, // Tangential
    ];

    testCases.forEach(tc => {
        const subject = detectSubject(tc.q);
        const intent = classifyQueryIntent(tc.q);
        console.log(`Q: "${tc.q}"\n  Subject: ${subject} (Expected: ${tc.expectedSubject})\n  Intent: ${intent} (Expected: ${tc.expectedIntent})`);
    });
}

testPII();
testLogic();
