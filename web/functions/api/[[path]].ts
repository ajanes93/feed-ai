interface Env {
  API: Fetcher;
}

// Proxy all /api/* requests to the API worker via service binding
export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  return context.env.API.fetch(
    new Request(`https://api${url.pathname}${url.search}`, context.request),
  );
};
