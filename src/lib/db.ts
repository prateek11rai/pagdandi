import "server-only";
import postgres from "postgres";
import { env } from "./env";

let client: postgres.Sql | undefined;

// One small pool per process. Tiger Data URLs carry sslmode=require.
export function sql(): postgres.Sql {
  client ??= postgres(env().DATABASE_URL, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 10,
    onnotice: () => {},
  });
  return client;
}

export async function closeDb(): Promise<void> {
  await client?.end({ timeout: 5 });
  client = undefined;
}
