// Version info - BUILD_ID and BUILD_DATE set during Docker build
export const VERSION = '0.1.0';
export const BUILD_ID = import.meta.env.VITE_BUILD_ID || 'dev';
export const BUILD_DATE = import.meta.env.VITE_BUILD_DATE || 'unknown';
