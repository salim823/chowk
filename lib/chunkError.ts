/**
 * Detects chunk-load / dynamic-import failures. These happen when the user
 * has an older deployment's page open and a new deployment renames the JS
 * chunks: a client-side navigation then 404s on the old chunk URL and the
 * app crashes into the global error page. A single hard reload pulls the
 * current build and self-heals.
 */
export function isChunkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const name = (error as { name?: string }).name ?? "";
  const message = (error as { message?: string }).message ?? "";
  const stack = (error as { stack?: string }).stack ?? "";
  const text = `${name}: ${message}\n${stack}`;
  return (
    name === "ChunkLoadError" ||
    /loading chunk [\w-]+ failed/i.test(text) ||
    /failed to fetch dynamically imported module/i.test(text) ||
    /importing a module script failed/i.test(text) ||
    /chunkloaderror/i.test(text)
  );
}
