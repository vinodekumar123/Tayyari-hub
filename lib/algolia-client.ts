import { algoliasearch } from 'algoliasearch';

const APP_ID = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID || '';
const SEARCH_KEY = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY || '';

export const searchClient = algoliasearch(APP_ID, SEARCH_KEY);

export const QUESTIONS_INDEX = 'questions';
export const MOCK_QUESTIONS_INDEX = 'mock-questions';
