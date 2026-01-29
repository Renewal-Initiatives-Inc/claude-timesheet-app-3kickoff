import '@testing-library/jest-dom/vitest';
import { vi, beforeEach, afterEach, afterAll } from 'vitest';

// Mock fetch globally
global.fetch = vi.fn();

// Mock localStorage with proper implementation
const localStorageStore: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageStore[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageStore[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageStore[key];
  }),
  clear: vi.fn(() => {
    Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
  }),
  get length() {
    return Object.keys(localStorageStore).length;
  },
  key: vi.fn((index: number) => Object.keys(localStorageStore)[index] ?? null),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Clear localStorage mock before each test
beforeEach(() => {
  Object.keys(localStorageStore).forEach((key) => delete localStorageStore[key]);
  vi.clearAllMocks();
});

// Explicit cleanup after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Clear any lingering state after all tests in a file
afterAll(() => {
  vi.resetModules();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
