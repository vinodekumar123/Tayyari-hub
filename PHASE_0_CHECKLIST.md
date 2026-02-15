# Phase 0 Checklist - Critical Fixes (Week 1)

**Status**: 🔴 READY TO START  
**Duration**: 1 week (5 working days)  
**Team Size**: 1-2 developers  
**Goal**: Make application production-ready and deployable

---

## 0.1: Fix Build Failure - OpenAI API Key

### Overview
Build fails when `OPENAI_API_KEY` is missing. Need to handle optional API keys gracefully.

### Tasks

#### Task 0.1.1: Audit AI Endpoints
- [ ] Review all files that use OpenAI/Gemini
  - `app/api/ai/generate-mcq/route.ts` - **PRIMARY ISSUE**
  - `lib/gemini.ts` - Gemini initialization
  - Search for: `openai`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI`
  
#### Task 0.1.2: Create API Key Validation Utility
**File to Create**: `lib/validateEnv.ts`

```typescript
// pseudocode
export const validateEnv = () => {
  const required = ['FIREBASE_*', 'NEXT_PUBLIC_*'];
  const optional = ['OPENAI_API_KEY', 'GOOGLE_GENERATIVE_AI_API_KEY'];
  
  // Check required keys
  // Log warnings for optional missing keys
  // Return status object
};
```

- [ ] Define required vs optional env vars
- [ ] Add validation at app startup
- [ ] Return detailed error messages
- [ ] Test with `.env.local` cleared

#### Task 0.1.3: Update API Routes for Graceful Degradation
**Files to Update**:
- `app/api/ai/generate-mcq/route.ts`
- `app/api/chat-support/route.ts` (if uses OpenAI)
- Any other AI endpoint

**Pattern to Use**:
```typescript
export async function POST(request: Request) {
  try {
    // Check if AI service is available
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        error: 'AI service unavailable',
        message: 'OpenAI API key not configured',
        suggestion: 'Please contact support or try basic quiz instead'
      }, { status: 503 });
    }
    
    // ... rest of implementation
  } catch (error) {
    // Handle errors
  }
}
```

- [ ] Check for API key before calling service
- [ ] Return 503 (Service Unavailable) with clear message
- [ ] Log the unavailability
- [ ] Provide user-facing alternative

#### Task 0.1.4: Update Build Process
**File to Update**: `next.config.js`

- [ ] Add build-time check that doesn't throw if keys missing
- [ ] Skip AI route collection if keys missing
- [ ] Log warnings (not errors) to console

#### Task 0.1.5: Test Build Success
```bash
# Test 1: Clear env var and rebuild
unset OPENAI_API_KEY
npm run build  # Should succeed
npm start      # Should work

# Test 2: API call without key
curl http://localhost:3000/api/ai/generate-mcq \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"prompt": "test"}'
# Should return 503 with helpful message

# Test 3: With key
set OPENAI_API_KEY=sk-test...
npm run build  # Should work normally
```

- [ ] Build completes without errors
- [ ] Console shows no OPENAI_API_KEY errors
- [ ] API endpoint returns 503 (not 500)
- [ ] Error message is user-friendly

### Estimated Time: 2-3 hours

---

## 0.2: Remove Debug Logs & Clean Build Artifacts

### Overview
Remove console.logs from production code and delete build artifacts from git.

### Tasks

#### Task 0.2.1: Identify & Remove Console Logs
**Files with Console Logs**:
- `app/admin/quizzes/create/page.tsx` - 6+ console.logs
- `app/admin/questions/auto-tagger/page.tsx` - debug logs
- `app/api/quiz/validate/route.ts` - file logging
- Any others found via grep

**What to Remove**:
- `console.log()` - all development logs
- `console.warn()` - warnings (keep only if important)
- `console.error()` - keep, but wrap with logger
- File-based logging to `.txt` files

**Pattern**:
```typescript
// BEFORE
console.log("Debug info:", data);
console.log("Teacher Debug:", variables);

// AFTER
// Remove entirely (or use logger in Phase 1)
```

- [ ] Find all console statements with grep
- [ ] Remove or comment out production console logs
- [ ] Keep console.error for critical failures
- [ ] Verify: `grep -r "console\.log" app/` returns nothing

#### Task 0.2.2: Remove Custom Debug Logging
**Files to Update**:
- `app/api/quiz/validate/route.ts` - removes file logging to `debug_log.txt`
- Remove `logDebug()` function and all its calls

**Files to Remove** (if only used for debugging):
- `app/api/quiz/validate/route.ts` - the `logDebug()` implementation

- [ ] Remove custom debug utilities
- [ ] Remove all calls to custom loggers
- [ ] Remove file operations for logging

#### Task 0.2.3: Update .gitignore for Build Artifacts
**File**: `.gitignore` - Add these entries:

```
# Build & Compilation Errors/Logs
build_error*.txt
build_error_*.txt
build_log*.txt
build_log_*.txt
build_timing.txt
tsc_errors.txt
tsc_errors_*.txt
tsc-output.txt
debug_log.txt
debug_log_*.txt
debug-*.js
debug-*.ts
lint_log.txt

# Temporary Debug Files
list-*.js
check-*.js
fix-*.ps1
models.json
```

- [ ] Update `.gitignore` with patterns
- [ ] Test: `git status` shows no tracked log files

#### Task 0.2.4: Remove Tracked Log Files from Git
```bash
# Remove from git history but keep locally (for debugging)
git rm --cached build_error*.txt
git rm --cached build_log*.txt
git rm --cached tsc_errors*.txt
git rm --cached debug_log.txt
git rm --cached list-*.js
git rm --cached check-*.js
git commit -m "chore: remove debug artifacts from git tracking"
```

- [ ] Run `git rm --cached` for all log files
- [ ] Commit the removal
- [ ] Verify: `git status` clean, local files still exist

#### Task 0.2.5: Verify Clean Console in Production Build
```bash
npm run build
npm start

# Check:
# - No console logs in Network tab (XHR/Fetch)
# - No console logs in Browser DevTools Console
# - No errors in .next/ folder from logging
```

- [ ] Production build has no console.logs
- [ ] Browser console clean
- [ ] No performance issues from removed logs

### Estimated Time: 2-3 hours

### Files to Check
```
grep -r "console\.log\|console\.warn\|logDebug\|debug_log" app/ --include="*.ts" --include="*.tsx"
```

---

## 0.3: Setup Environment Validation

### Overview
Validate all required/optional env vars at startup and provide clear error messages.

### Tasks

#### Task 0.3.1: Create Environment Validation Schema
**File to Create**: `lib/validateEnv.ts`

```typescript
// Schema structure
interface EnvConfig {
  required: string[];      // Must be present
  optional: string[];      // Nice to have
  secrets: string[];       // Should never be logged
  buildTime: string[];     // Fail build if missing
}

// Exports
- validateEnv() -> { valid: boolean; errors: string[]; warnings: string[] }
- getEnvStatus() -> detailed status object
- assertEnvVar(key: string) -> throws if missing (for critical paths)
```

Examples of env vars to track:
```
REQUIRED (for build):
- NEXT_PUBLIC_FIREBASE_API_KEY
- NEXT_PUBLIC_FIREBASE_PROJECT_ID
- NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- (others from firebase.ts)

OPTIONAL (features disabled if missing):
- OPENAI_API_KEY (AI features)
- GOOGLE_GENERATIVE_AI_API_KEY (Gemini features)
- ALGOLIA_APP_ID (Search features)
- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY (Payments)

SECRETS (never log):
- API keys, database credentials, auth tokens
```

- [ ] Define required env vars list
- [ ] Define optional env vars list
- [ ] Define secrets that should be redacted
- [ ] Export validation function

#### Task 0.3.2: Integrate Validation at App Startup
**File to Update**: `app/layout.tsx` or `app/firebase.ts`

```typescript
// At startup
if (typeof window === 'undefined') {  // Server-side only
  const envStatus = validateEnv();
  if (!envStatus.valid) {
    console.error('⚠️ Missing required environment variables:', envStatus.errors);
    process.exit(1);  // Fail build
  }
  
  if (envStatus.warnings.length > 0) {
    console.warn('⚠️ Optional features disabled:', envStatus.warnings);
  }
}
```

- [ ] Call validation at server startup
- [ ] Exit process if critical vars missing
- [ ] Log warnings for optional missing vars
- [ ] Do NOT log sensitive values

#### Task 0.3.3: Create Error Page for Missing Config
**File to Create**: `app/env-error/page.tsx`

Show this page if env validation fails on client side:
```
❌ Application Configuration Error

The following environment variables are required:
- REACT_APP_FIREBASE_API_KEY

Please contact your administrator or set these variables.

Debug Info: [Show error list only in development]
```

- [ ] Create error page component
- [ ] Only show debug info in development
- [ ] User-friendly message in production

#### Task 0.3.4: Test Validation Logic
```bash
# Test 1: Build with all env vars (should succeed)
npm run build

# Test 2: Temporarily unset non-critical var
unset OPENAI_API_KEY
npm run build
# Should show warning but succeed

# Test 3: Unset critical var
unset NEXT_PUBLIC_FIREBASE_API_KEY
npm run build
# Should fail with clear error message
```

- [ ] Validation runs at startup
- [ ] Clear error messages for missing vars
- [ ] Build succeeds even with optional vars missing
- [ ] Build fails if critical vars missing (expected)

#### Task 0.3.5: Document Environment Setup
**File to Update** or **Create**: `docs/ENVIRONMENT_SETUP.md`

Include:
- Which env vars are required
- How to find/set each env var
- What breaks if optional vars are missing
- How to validate setup locally

- [ ] Document all env vars
- [ ] Document why each is needed
- [ ] Provide setup instructions

### Estimated Time: 1-2 hours

---

## Summary & Verification

### Deliverables
1. ✅ Build passes without OPENAI_API_KEY
2. ✅ No console.logs in production build
3. ✅ All debug files removed from git
4. ✅ Environment validation operational
5. ✅ Clear error messages for missing config

### Final Verification Checklist
```bash
# 1. Clean build
rm -rf .next node_modules
npm install
npm run build
# Result: SUCCESS (no errors about API keys)

# 2. Check console
npm start
# Open browser DevTools Console
# Result: CLEAN (no logs, no errors)

# 3. Check git status
git status
# Result: No build artifacts listed

# 4. Test validation
# Unset OPENAI_API_KEY
npm start
# Result: Clear warning about deactivated AI features

# 5. Test error handling
# Unset FIREBASE_PROJECT_ID
npm start
# Result: Clear error message about missing config
```

### Deployment Readiness
- [ ] Code reviewed by 1 other developer
- [ ] All tests passing
- [ ] Build time acceptable (< 60 seconds)
- [ ] No performance regressions
- [ ] Ready to deploy to staging

### Next Steps
- Merge Phase 0 to main branch
- Deploy to testing environment
- Prepare Phase 1 security improvements
- Schedule Phase 1 kickoff meeting

---

## Notes & Questions

### Decisions Made in Phase 0
1. **Logging Strategy**: Use structured logging in Phase 1; for now just remove console logs
2. **API Key Fallback**: Return 503 (Service Unavailable) rather than failing gracefully on client
3. **Build Artifacts**: Keep locally for debugging, remove from git
4. **Validation Timing**: Run at server startup (next.js build-time), not client-time

### Open Questions
- Should AI features have a fallback (e.g., basic question generation) or just disable?
- Keep `debug_log.txt` in `.gitignore` for local developers to use?
- Should validation log to file for later analysis?

---

**Phase 0 Start Date**: [To be scheduled]  
**Phase 0 End Date**: [To be scheduled]  
**Owner**: [Assign developer]  
**Reviewer**: [Assign senior dev]

---

**Status**: Ready to begin → Move to in-progress once work starts
