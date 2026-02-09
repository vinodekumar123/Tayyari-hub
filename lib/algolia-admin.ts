import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const ADMIN_KEY = process.env.ALGOLIA_ADMIN_KEY || '';

export const adminClient = algoliasearch(APP_ID, ADMIN_KEY);

export const QUESTIONS_INDEX = 'questions';
export const MOCK_QUESTIONS_INDEX = 'mock-questions';
