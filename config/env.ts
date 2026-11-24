// Single code location of the default stand URL.
export const DEFAULT_BASE_URL = 'https://finmore.netlify.app';

// Lazy getters: evaluated after .env.local has been loaded.
export const getBaseUrl = () => process.env.BASE_URL || DEFAULT_BASE_URL; // `||` ignores empty strings
export const getEmailDomain = () => process.env.TEST_EMAIL_DOMAIN || 'example.com';
export const isCI = () => !!process.env.CI;
