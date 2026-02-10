// Proxy all /api/* requests to the API worker
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  return fetch(
    new Request(
      `https://feed-ai-api.andresjanes.workers.dev${url.pathname}${url.search}`,
      context.request,
    ),
  );
};
