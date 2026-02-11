import { ref } from "vue";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

const fingerprint = ref("");
let initialized = false;

export function useDeviceFingerprint() {
  if (!initialized && typeof window !== "undefined") {
    initialized = true;
    FingerprintJS.load()
      .then((fp) => fp.get())
      .then((result) => {
        fingerprint.value = result.visitorId;
      })
      .catch(() => {
        // Fallback: random ID when fingerprinting fails (ad blockers, etc.)
        fingerprint.value = crypto.randomUUID().replace(/-/g, "");
      });
  }

  return { fingerprint };
}
