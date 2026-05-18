import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config as loadEnv } from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: resolve(__dirname, "../../.env") });

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zapstore/db"],
  env: {
    NEXT_PUBLIC_APP_URL: process.env.PUBLIC_APP_URL ?? "http://localhost:3000",
  },
};

export default nextConfig;
