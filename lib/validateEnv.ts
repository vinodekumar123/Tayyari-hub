type EnvStatus = {
  valid: boolean;
  requiredMissing: string[];
  optionalMissing: string[];
  errors: string[];
  warnings: string[];
  hasOpenAI: boolean;
  hasGemini: boolean;
  hasAlgolia: boolean;
};

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
];

const optionalEnvVars = [
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'ALGOLIA_APP_ID',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
];

const secretEnvVars = [
  'OPENAI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
];

const isDefined = (key: string): boolean => {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
};

const intersect = (keys: string[]): string[] => keys.filter((key) => !isDefined(key));

export const getEnvStatus = (): EnvStatus => {
  const requiredMissing = intersect(requiredEnvVars);
  const optionalMissing = intersect(optionalEnvVars);

  const status: EnvStatus = {
    valid: requiredMissing.length === 0,
    requiredMissing,
    optionalMissing,
    errors: requiredMissing.map((key) => `Missing required env: ${key}`),
    warnings: optionalMissing.map((key) => `Optional feature disabled: ${key}`),
    hasOpenAI: isDefined('OPENAI_API_KEY'),
    hasGemini: isDefined('GOOGLE_GENERATIVE_AI_API_KEY'),
    hasAlgolia: isDefined('ALGOLIA_APP_ID'),
  };

  return status;
};

export const validateEnv = (): EnvStatus => {
  const status = getEnvStatus();

  if (!status.valid) {
    console.error('[env] Missing required environment variables:', status.requiredMissing.join(', '));
  }

  if (status.optionalMissing.length) {
    console.warn('[env] Optional environment variables missing:', status.optionalMissing.join(', '));
  }

  return status;
};

export const assertEnvVar = (key: string): string => {
  if (!isDefined(key)) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return process.env[key]!.trim();
};

export const isOpenAIEnabled = (): boolean => getEnvStatus().hasOpenAI;

export const isGeminiEnabled = (): boolean => getEnvStatus().hasGemini;

export const isAlgoliaEnabled = (): boolean => getEnvStatus().hasAlgolia;
