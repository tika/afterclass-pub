import { LogLayer, ConsoleTransport } from "loglayer";
import { BetterStackTransport } from "@loglayer/transport-betterstack";
import { getSimplePrettyTerminal, moonlight } from "@loglayer/transport-simple-pretty-terminal";

const token = process.env.BETTERSTACK_API_SOURCE_TOKEN;
const ingestUrl = process.env.BETTERSTACK_INGEST_URL ?? "https://in.logs.betterstack.com";
const isDev = process.env.NODE_ENV !== "production";

const transports = [
  // Development: pretty terminal output; production: plain console
  ...(isDev
    ? [
        getSimplePrettyTerminal({
          viewMode: "expanded",
          theme: moonlight,
        }),
      ]
    : [
        new ConsoleTransport({
          logger: console,
          level: "info",
        }),
      ]),
  ...(token
    ? [
        new BetterStackTransport({
          sourceToken: token,
          url: ingestUrl,
          level: "info",
          onError: (err) => console.error("[LogLayer] BetterStack send failed:", err),
        }),
      ]
    : []),
];

const logLayer = new LogLayer({
  transport: transports,
});

function info(message: string, data?: Record<string, unknown>) {
  if (data) {
    logLayer.withMetadata(data).info(message);
  } else {
    logLayer.info(message);
  }
}

function warn(message: string, data?: Record<string, unknown>) {
  if (data) {
    logLayer.withMetadata(data).warn(message);
  } else {
    logLayer.warn(message);
  }
}

function error(message: string, data?: Record<string, unknown>) {
  if (data) {
    logLayer.withMetadata(data).error(message);
  } else {
    logLayer.error(message);
  }
}

function debug(message: string, data?: Record<string, unknown>) {
  if (data) {
    logLayer.withMetadata(data).debug(message);
  } else {
    logLayer.debug(message);
  }
}

async function flush() {
  // BetterStack transport batches async; allow time for in-flight sends
  await new Promise((r) => setTimeout(r, 500));
}

export const logger = { info, warn, error, debug, flush };
export { logLayer };
