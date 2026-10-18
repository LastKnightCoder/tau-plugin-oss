import { JSDOM } from "jsdom";
import { afterAll, vi } from "vitest";
const browser = new JSDOM("", { url: "https://localhost" }).window;
// 仅补齐SDK使用的浏览器对象；保留本机HTTP测试使用的fetch和AbortSignal。
for (const key of [
  "window",
  "location",
  "navigator",
  "Blob",
  "FileReader",
] as const)
  vi.stubGlobal(key, key === "window" ? browser : browser[key]);
afterAll(() => {
  browser.close();
  vi.unstubAllGlobals();
});
