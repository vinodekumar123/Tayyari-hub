import { algoliasearch, SearchClient } from 'algoliasearch';

let _adminClient: SearchClient | null = null;

// Lazy initialization to prevent build-time errors
export function getAdminClient(): SearchClient {
    if (!_adminClient) {
        const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
        const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';
        _adminClient = algoliasearch(APP_ID, ADMIN_KEY);
    }
    return _adminClient;
}

export const QUESTIONS_INDEX = 'questions';
export const MOCK_QUESTIONS_INDEX = 'mock-questions';
