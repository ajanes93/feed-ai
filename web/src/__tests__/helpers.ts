import { vi } from "vitest";

export function stubFetchResponses(
  responses: Record<string, { status: number; body: unknown }>
) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation((url: string) => {
      for (const [pattern, response] of Object.entries(responses)) {
        if (url.includes(pattern)) {
          return Promise.resolve({
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            json: () => Promise.resolve(response.body),
          });
        }
      }
      return Promise.resolve({
        ok: false,
        status: 404,
        json: () => Promise.resolve({}),
      });
    })
  );
}

export function stubFetchJson(body: unknown, ok = true) {
  stubFetchResponses({
    "": { status: ok ? 200 : 500, body },
  });
}
