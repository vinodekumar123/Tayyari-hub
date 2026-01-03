"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const admin = __importStar(require("firebase-admin"));
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config({ path: '.env.local' });
// --- Configuration ---
const DRY_RUN = !process.argv.includes('--execute');
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};
async function initFirebase() {
    console.log(`${colors.blue}Initializing Firebase Admin SDK...${colors.reset}`);
    try {
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
            const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
            if (serviceAccount.private_key) {
                serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
            }
            // Write to temp file for robustness
            const tempPath = path.join(process.cwd(), 'temp-creds-auth.json');
            fs.writeFileSync(tempPath, JSON.stringify(serviceAccount));
            admin.initializeApp({
                credential: admin.credential.cert(tempPath),
                projectId: serviceAccount.project_id
            });
            console.log(`${colors.green}✅ Firebase initialized.${colors.reset}`);
            return tempPath;
        }
        else {
            console.log("No env var found, trying default credentials...");
            admin.initializeApp();
            return null;
        }
    }
    catch (error) {
        console.error(`${colors.red}❌ Failed to initialize Firebase:${colors.reset}`, error);
        process.exit(1);
    }
}
async function getAllAuthUsers(auth) {
    console.log("Fetching all Auth users...");
    let allUsers = [];
    let pageToken = undefined;
    do {
        const result = await auth.listUsers(1000, pageToken);
        allUsers = allUsers.concat(result.users);
        pageToken = result.pageToken;
        process.stdout.write('.');
    } while (pageToken);
    console.log(`\nFetched ${allUsers.length} total users.`);
    return allUsers;
}
async function main() {
    const tempCredsPath = await initFirebase();
    // Ensure cleanup on exit
    const cleanup = () => {
        if (tempCredsPath) {
            try {
                if (fs.existsSync(tempCredsPath))
                    fs.unlinkSync(tempCredsPath);
            }
            catch (e) { }
        }
    };
    process.on('exit', cleanup);
    process.on('SIGINT', () => { cleanup(); process.exit(); });
    process.on('uncaughtException', (e) => { console.error(e); cleanup(); process.exit(1); });
    const db = admin.firestore();
    const auth = admin.auth();
    console.log(`\n${colors.cyan}--- STARTING AUTH-ONLY DELETION TARGETING NON-ADMINS ---${colors.reset}`);
    if (DRY_RUN) {
        console.log(`${colors.yellow}⚠️  DRY RUN MODE: No changes will be made.${colors.reset}`);
        console.log(`${colors.yellow}Run with --execute to perform actual deletion.${colors.reset}\n`);
    }
    try {
        // 1. Define Admins to EXCLUDE (Manual List since Firestore is inaccessible)
        // TODO: Add Admin emails here
        const EXCLUDED_EMAILS = [
            'admin@tayyarihub.com',
            'superadmin@tayyarihub.com',
            // Add user's specific email if known, or ask them to add it
        ];
        // Parse command line args for --exclude
        const args = process.argv.slice(2);
        const excludeFlagIndex = args.findIndex(a => a.startsWith('--exclude='));
        if (excludeFlagIndex !== -1) {
            const emails = args[excludeFlagIndex].split('=')[1].split(',');
            emails.forEach(e => EXCLUDED_EMAILS.push(e.trim()));
        }
        console.log(`${colors.cyan}Configuration:${colors.reset}`);
        console.log(`   Excluded Emails: ${EXCLUDED_EMAILS.join(', ')}`);
        // 2. Fetch All Auth Users
        const allAuthUsers = await getAllAuthUsers(auth);
        // 3. Filter
        const usersToDelete = allAuthUsers.filter(user => !EXCLUDED_EMAILS.includes(user.email || ''));
        console.log(`\nAnalysis:`);
        console.log(`   Total Auth Users: ${allAuthUsers.length}`);
        console.log(`   Excluded Users: ${allAuthUsers.length - usersToDelete.length}`);
        console.log(`   Candidates to Delete: ${colors.red}${usersToDelete.length}${colors.reset}`);
        if (usersToDelete.length === 0) {
            console.log("No users to delete.");
            return;
        }
        // 4. Delete
        if (DRY_RUN) {
            console.log("\n[DRY RUN] The following users would be deleted:");
            usersToDelete.slice(0, 500).forEach(u => console.log(`   - ${u.email} (${u.uid})`));
            if (usersToDelete.length > 500)
                console.log(`   ... and ${usersToDelete.length - 10} more.`);
        }
        else {
            console.log(`\n${colors.red}DELETING ${usersToDelete.length} USERS...${colors.reset}`);
            // Batch delete seems to be what we want but admin SDK has deleteUsers(uids)
            // It accepts up to 1000 IDs.
            const uidsToDelete = usersToDelete.map(u => u.uid);
            const BATCH_LIMIT = 1000;
            for (let i = 0; i < uidsToDelete.length; i += BATCH_LIMIT) {
                const batch = uidsToDelete.slice(i, i + BATCH_LIMIT);
                const result = await auth.deleteUsers(batch);
                console.log(`   Batch ${i / BATCH_LIMIT + 1}: Deleted ${result.successCount} users. Failed: ${result.failureCount}.`);
                if (result.failureCount > 0) {
                    result.errors.forEach(e => console.error(`      Error: ${e.error.toJSON()}`));
                }
            }
            console.log(`${colors.green}Deletion Complete.${colors.reset}`);
        }
    }
    catch (e) {
        console.error(`${colors.red}Error:${colors.reset}`, e);
    }
}
main();
