import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Mock environment variables for testing
process.env.AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.NODE_ENV = 'test'

// Mock Cloudflare context
global.getCloudflareContext = vi.fn().mockResolvedValue({
  env: {
    WEBHOOKS: {
      send: vi.fn().mockResolvedValue({})
    }
  }
})

// Mock @opennextjs/cloudflare module
vi.mock('@opennextjs/cloudflare', () => ({
  getCloudflareContext: vi.fn().mockResolvedValue({
    env: {
      WEBHOOKS: {
        send: vi.fn().mockResolvedValue({})
      }
    }
  })
}))

// Mock better-auth-cloudflare to avoid ESM issues
vi.mock('better-auth-cloudflare', () => ({
  drizzleAdapter: vi.fn(() => ({
    db: vi.fn(),
    options: { usePlural: true }
  }))
}))

// Mock @noble/ciphers to avoid ESM issues
vi.mock('@noble/ciphers', () => ({
  chacha20: vi.fn(),
  chacha20poly1305: vi.fn(),
}))

// Mock better-auth to avoid ESM issues
vi.mock('better-auth', () => ({
  betterAuth: vi.fn(() => ({
    api: {
      signIn: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    }
  }))
}))

// Mock crypto for consistent UUIDs in tests
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn(() => 'test-uuid-1234-5678-9012')
  },
  writable: true
});

// Mock Next.js headers
vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers())
}))

// Suppress console.log during tests unless explicitly testing logging
const originalConsoleLog = console.log
const originalConsoleError = console.error

beforeAll(() => {
  console.log = vi.fn()
  console.error = vi.fn()
})

afterAll(() => {
  console.log = originalConsoleLog
  console.error = originalConsoleError
})
