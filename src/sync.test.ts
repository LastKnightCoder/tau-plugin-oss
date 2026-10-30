import { createServer, type Server } from "node:http";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { SyncProvider } from "@tau/plugins/sync";
import { verifyOssV4 } from "../tests/verify-oss-v4";

const target = vi.hoisted(() => ({ endpoint: "" }));
vi.mock("ali-oss", async importOriginal => {
  const { default: OSS } = await importOriginal<{
    default: typeof import("ali-oss");
  }>();
  return {
    default: class extends OSS {
      constructor(options: ConstructorParameters<typeof OSS>[0]) {
        super({
          ...options,
          endpoint: target.endpoint,
          cname: true,
          secure: false,
        });
      }
    },
  };
});
import { createOssSyncProvider } from "./sync";

let server: Server, provider: SyncProvider;
let versioning = "",
  versionDenied = false;
let region = "cn-chengdu";
const objects = new Map<string, Buffer>();
const requests: {
  method: string;
  key: string;
  conditional: boolean;
  signed: boolean;
  acl: unknown;
  storageClass: unknown;
  expires: string | null;
}[] = [];
beforeEach(async () => {
  expect(typeof globalThis.fetch).toBe("function");
  expect(typeof AbortSignal.timeout).toBe("function");
  objects.clear();
  requests.length = 0;
  versioning = "";
  versionDenied = false;
  region = "cn-chengdu";
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost"),
      key = decodeURIComponent(url.pathname.slice(1));
    requests.push({
      method: req.method ?? "",
      key,
      conditional: req.headers["x-oss-forbid-overwrite"] === "true",
      signed: verifyOssV4(req, "bucket", region),
      acl: req.headers["x-oss-object-acl"],
      storageClass: req.headers["x-oss-storage-class"],
      expires: url.searchParams.get("x-oss-expires"),
    });
    const fail = (status: number, code: string) => {
      res.writeHead(status, {
        "content-type": "application/xml",
        "x-oss-request-id": "test",
      });
      res.end(
        `<Error><Code>${code}</Code><Message>test</Message><RequestId>test</RequestId></Error>`
      );
    };
    if (
      !requests[requests.length - 1].signed ||
      key.endsWith("denied") ||
      url.searchParams.get("prefix")?.endsWith("denied")
    )
      return fail(403, "AccessDenied");
    if (url.searchParams.has("versioning")) {
      if (versionDenied) return fail(403, "AccessDenied");
      res.setHeader("content-type", "application/xml");
      return res.end(
        `<VersioningConfiguration><Status>${versioning}</Status></VersioningConfiguration>`
      );
    }
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      for await (const part of req) chunks.push(Buffer.from(part));
      if (
        req.headers["content-md5"] !==
        createHash("md5").update(Buffer.concat(chunks)).digest("base64")
      )
        return fail(400, "InvalidDigest");
      if (req.headers["x-oss-forbid-overwrite"] === "true" && objects.has(key))
        return fail(409, "FileAlreadyExists");
      objects.set(key, Buffer.concat(chunks));
      res.setHeader("ETag", '"test"');
      return res.end();
    }
    if (url.searchParams.has("prefix") || (key === "" && req.method === "GET")) {
      const prefix = url.searchParams.get("prefix") ?? "",
        marker = url.searchParams.get("marker") ?? "";
      const keys = [...objects.keys()]
        .filter(name => name.startsWith(prefix) && name > marker)
        .sort();
      const names = keys.slice(0, 1),
        more = keys.length > 1;
      res.setHeader("content-type", "application/xml");
      return res.end(
        `<ListBucketResult><Name>bucket</Name><IsTruncated>${more}</IsTruncated><NextMarker>${names[0] ?? ""}</NextMarker>${names.map(name => `<Contents><Key>${name}</Key><Size>${objects.get(name)!.length}</Size><LastModified>2026-10-18T00:00:00.000Z</LastModified><Owner><ID>test</ID><DisplayName>test</DisplayName></Owner></Contents>`).join("")}</ListBucketResult>`
      );
    }
    const data = objects.get(key);
    if (!data) return fail(404, "NoSuchKey");
    res.setHeader("Content-Length", data.length);
    res.setHeader("ETag", '"test"');
    res.end(req.method === "HEAD" ? undefined : data);
  });
  await new Promise<void>(resolve => server.listen(0, "localhost", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("测试服务器未启动");
  target.endpoint = "http://localhost:" + address.port;
  provider = createOssSyncProvider(
    {
      bucket: "bucket",
      region: "oss-cn-chengdu",
      accessKeyId: "test-key",
      accessKeySecret: "test-secret",
      path: "/note",
    },
    globalThis.fetch
  );
});
afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

it("普通上传直接PUT且允许覆盖，不额外HEAD；签名读取保留字节", async () => {
  expect(await provider.uploadFile("data", new Uint8Array([1, 2]))).toBe(true);
  expect(requests.map(item => item.method)).toEqual(["PUT"]);
  expect(requests[0].conditional).toBe(false);
  expect(requests[0].acl).toBe("private");
  expect(requests[0].storageClass).toBe("Standard");
  expect(await provider.uploadFile("data", new Uint8Array([3]))).toBe(true);
  expect(await provider.downloadFile("data")).toEqual(new Uint8Array([3]));
  expect(await provider.fileExists("data")).toBe(true);
  expect(requests.every(item => item.signed)).toBe(true);
  expect(requests.filter(item => item.method === "GET" || item.method === "HEAD")
    .every(item => item.expires === "300")).toBe(true);
});
it("条件创建保留版本控制检查与原子防覆盖，竞争不会覆盖先提交的对象", async () => {
  const results = await Promise.allSettled(
    [1, 2].map(n => provider.createFileIfAbsent("commit", new Uint8Array([n])))
  );
  expect(results.filter(item => item.status === "fulfilled" && item.value)).toHaveLength(1);
  expect(requests.filter(item => item.method === "PUT").every(item => item.conditional)).toBe(true);
  const before = objects.get("note/commit");
  await expect(provider.createFileIfAbsent("commit", new Uint8Array([9]))).rejects.toThrow();
  expect(objects.get("note/commit")).toEqual(before);
});
it.each(["Enabled", "Suspended"])("桶版本控制为%s时条件创建拒绝，不影响普通上传", async mode => {
  versioning = mode;
  await expect(provider.createFileIfAbsent("commit", new Uint8Array([1]))).rejects.toThrow(
    "版本控制"
  );
  expect(requests.filter(item => item.method === "PUT")).toHaveLength(0);
  expect(await provider.uploadFile("data", new Uint8Array([1]))).toBe(true);
});
it("分页在插件内部聚合，相对路径与大小正确", async () => {
  await provider.uploadFile("folder/a", new Uint8Array([1]));
  await provider.uploadFile("folder/b", new Uint8Array([1, 2]));
  expect(await provider.listFiles("folder")).toMatchObject([
    { name: "a", path: "folder/a", size: 1 },
    { name: "b", path: "folder/b", size: 2 },
  ]);
});
it("只有404视为不存在，权限失败不伪装成功，版本检查失败不执行PUT", async () => {
  expect(await provider.fileExists("missing")).toBe(false);
  await expect(provider.fileExists("denied")).rejects.toMatchObject({
    status: 403,
  });
  await expect(provider.downloadFile("denied")).rejects.toMatchObject({
    status: 403,
  });
  expect(await provider.uploadFile("denied", new Uint8Array())).toBe(false);
  versionDenied = true;
  requests.length = 0;
  await expect(provider.createFileIfAbsent("commit", new Uint8Array())).rejects.toThrow();
  expect(requests.some(item => item.method === "PUT")).toBe(false);
});

it("带目录分隔符的前缀不扩展到其他目录，列举权限失败抛错", async () => {
  await provider.uploadFile("resources/a", new Uint8Array([1]));
  await provider.uploadFile("resources-old/b", new Uint8Array([2]));
  expect(await provider.listFiles("resources/")).toMatchObject([
    { name: "a", path: "resources/a" },
  ]);
  await expect(provider.listFiles("denied")).rejects.toThrow();
});

it.each([
  ["oss-cn-chengdu", "cn-chengdu", "/同步目录/"],
  ["oss-cn-hangzhou", "cn-hangzhou", "/"],
])("%s 在%s作用域完成V4同步读写、条件创建和分页", async (sdkRegion, signRegion, path) => {
  region = signRegion;
  const service = createOssSyncProvider({
    bucket: "bucket",
    region: sdkRegion,
    accessKeyId: "test-key",
    accessKeySecret: "test-secret",
    path,
  }, globalThis.fetch);
  const name = "子目录/截图 中文 #+%!'().db";
  const bytes = new Uint8Array([0, 255, 1, 128]);
  expect(await service.uploadFile(name, bytes)).toBe(true);
  expect(await service.downloadFile(name)).toEqual(bytes);
  expect(await service.fileExists(name)).toBe(true);
  expect(await service.createFileIfAbsent("versions/提交-1", bytes)).toBe(true);
  await expect(service.createFileIfAbsent("versions/提交-1", new Uint8Array([9])))
    .rejects.toThrow();
  expect(await service.downloadFile("versions/提交-1")).toEqual(bytes);
  expect((await service.listFiles()).map(file => file.path).sort())
    .toEqual([name, "versions/提交-1"].sort());
  expect(requests.every(request => request.signed)).toBe(true);
});

it("错误密钥在V4请求头和预签名URL中均被拒绝，不降级为V1", async () => {
  const service = createOssSyncProvider({
    bucket: "bucket",
    region: "oss-cn-chengdu",
    accessKeyId: "test-key",
    accessKeySecret: "wrong-secret",
    path: "/note",
  }, globalThis.fetch);
  expect(await service.uploadFile("data", new Uint8Array([1]))).toBe(false);
  await expect(service.downloadFile("data")).rejects.toMatchObject({ status: 403 });
  await expect(service.fileExists("data")).rejects.toMatchObject({ status: 403 });
  await expect(service.listFiles()).rejects.toThrow();
  await expect(service.createFileIfAbsent("commit", new Uint8Array([1]))).rejects.toThrow();
  expect(requests).toHaveLength(5);
  expect(requests.every(request => !request.signed)).toBe(true);
});

it("预签名URL的有效期被修改后验签失败", async () => {
  expect(await provider.uploadFile("data", new Uint8Array([1]))).toBe(true);
  const tamperedFetch: typeof globalThis.fetch = (input, init) => {
    const url = new URL(String(input));
    if (url.searchParams.has("x-oss-expires")) url.searchParams.set("x-oss-expires", "301");
    return globalThis.fetch(url, init);
  };
  const service = createOssSyncProvider({
    bucket: "bucket",
    region: "oss-cn-chengdu",
    accessKeyId: "test-key",
    accessKeySecret: "test-secret",
    path: "/note",
  }, tamperedFetch);
  await expect(service.downloadFile("data")).rejects.toMatchObject({ status: 403 });
  await expect(service.fileExists("data")).rejects.toMatchObject({ status: 403 });
  expect(requests.slice(1).every(request => !request.signed)).toBe(true);
});
