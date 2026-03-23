export interface CloudflareBindings {
  DATABASE: D1Database;
  AUTH_SECRET?: string;
  DESTINATION_ENCRYPTION_KEY?: string;
}

declare global {
  namespace NodeJS {
    interface ProcessEnv extends CloudflareBindings {
      // Additional environment variables can be added here
    }
  }
}
