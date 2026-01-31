import { vi } from "vitest";
import { timingSafeEqual } from "crypto";

// Polyfill crypto.subtle.timingSafeEqual for Node (Cloudflare Workers API)
const originalCrypto = globalThis.crypto;
vi.stubGlobal("crypto", {
  ...originalCrypto,
  subtle: {
    ...originalCrypto.subtle,
    timingSafeEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
      return timingSafeEqual(Buffer.from(a), Buffer.from(b));
    },
  },
  randomUUID: () => originalCrypto.randomUUID(),
});
