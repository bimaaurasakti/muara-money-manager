// @ts-ignore
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:3000",
  pretendToBeVisual: true,
});

globalThis.window = dom.window as any;
globalThis.document = dom.window.document;
globalThis.navigator = dom.window.navigator;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Element = dom.window.Element;
globalThis.Node = dom.window.Node;
globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => setTimeout(callback, 0) as any;
globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

// Forward window properties
for (const key of Object.getOwnPropertyNames(dom.window)) {
  if (!(key in globalThis)) {
    try {
      (globalThis as Record<string, any>)[key] = (dom.window as any)[key];
    } catch {}
  }
}

// Mock next/navigation and setup testing-library cleanup AFTER DOM is initialized
const { vi, afterEach } = await import("vitest");
const { cleanup } = await import("@testing-library/react");

afterEach(() => {
  cleanup();
});

let currentParams = new URLSearchParams();
export const mockRouterReplace = vi.fn((url: string) => {
  const query = url.split("?")[1];
  currentParams = new URLSearchParams(query || "");
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockRouterReplace,
    push: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/transactions",
  useSearchParams: () => currentParams,
}));
