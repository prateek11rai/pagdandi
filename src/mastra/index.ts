import "./no-telemetry";
import { Mastra } from "@mastra/core";
import { trekGuide } from "./agents/trek-guide";

// No storage and no logger: chats are not stored and never logged.
export const mastra = new Mastra({
  agents: { trekGuide },
  logger: false,
});
