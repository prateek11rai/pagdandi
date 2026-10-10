// Apply db/migrations/*.sql in order, once each, each in its own transaction.
import path from "node:path";
import { closeDb } from "../src/lib/db";
import { loadEnv } from "../src/lib/env";
import { migrate, migrationFiles } from "../src/lib/trek-load";

loadEnv("db");
for (const name of await migrate(await migrationFiles(path.join(process.cwd(), "db", "migrations")))) console.log(`applied ${name}`);
await closeDb();
