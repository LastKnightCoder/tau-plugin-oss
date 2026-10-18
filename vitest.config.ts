import { defineConfig } from "vitest/config";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
const browserSdk = path.join(
  path.dirname(require.resolve("ali-oss/package.json")),
  "dist/aliyun-oss-sdk.js",
);
export default defineConfig({
  resolve: { alias: { "ali-oss": browserSdk } },
  test: {
    environment: "node",
    setupFiles: ["tests/browser.ts"],
    include: ["src/**/*.test.ts"],
  },
});
