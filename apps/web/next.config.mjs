import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone", // pra Docker (Dockerfile copia .next/standalone)
  outputFileTracingRoot: resolve(__dirname, "../.."),
  // Força incluir o Prisma Query Engine (binario .so.node) no bundle standalone.
  // Sem isso o Next nao detecta o engine e da "Query Engine not found" em runtime.
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*",
      "../../packages/db/node_modules/.prisma/client/**/*",
    ],
  },
  transpilePackages: ["@zapstore/db", "@zapstore/engine", "@zapstore/llm", "@zapstore/prompts", "@zapstore/payment", "@zapstore/whatsapp"],
  env: {
    NEXT_PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
