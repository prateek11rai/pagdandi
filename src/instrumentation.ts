// Validate the environment once when the server starts, with one line per missing variable.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadEnv } = await import("./lib/env");
    loadEnv("web");
  }
}
