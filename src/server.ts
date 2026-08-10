import { buildApp } from "./app";
import { disconnectPrisma } from "./db/prisma";
import { disconnectRedis } from "./db/redis";
import { loadEnv } from "./config/index";
import { connectPrisma } from "./db/prisma";
import { connectRedis } from "./db/redis";

type Signal = "SIGINT" | "SIGTERM";

async function main(): Promise<void> {
  const env = loadEnv();
  const app = await buildApp();

  await connectPrisma();
  await connectRedis(app.redis);

  const signals: Signal[] = ["SIGINT", "SIGTERM"];

  const gracefulShutdown = async (signal: Signal): Promise<void> => {
    app.log.info(`Received ${signal}, shutting down gracefully...`);

    try {
      await app.close();
      await disconnectPrisma();
      await disconnectRedis(app.redis);
      app.log.info("Graceful shutdown complete");
      process.exit(0);
    } catch (error) {
      app.log.error({ err: error }, "Error during graceful shutdown");
      process.exit(1);
    }
  };

  signals.forEach((signal) => {
    process.on(signal, () => {
      void gracefulShutdown(signal);
    });
  });

  const address = `${env.HOST}:${env.PORT}`;
  try {
    await app.listen({ host: env.HOST, port: env.PORT });
    app.log.info(`Server listening on http://${address}`);
  } catch (error) {
    app.log.fatal({ err: error }, "Failed to start server");
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Fatal error during startup:", error);
  process.exit(1);
});
