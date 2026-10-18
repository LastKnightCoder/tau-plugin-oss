import OSS from "ali-oss";
import type {
  JsonValue,
  SyncProvider,
  RemoteFileInfo,
} from "@tau/plugins/sync";
import { createTransport } from "./transport";

// 官方浏览器SDK支持此选项，类型包尚未声明。
const checksumOptions: OSS.PutObjectOptions & { disabledMD5: boolean } = {
  disabledMD5: false,
};

interface Config {
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
  region: string;
  path: string;
}
function parse(value: JsonValue): Config {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("OSS配置无效");
  const text = (key: string) => {
    const field = value[key];
    if (typeof field !== "string" || !field)
      throw new Error("请填写OSS凭据、桶和区域");
    return field;
  };
  return {
    accessKeyId: text("accessKeyId"),
    accessKeySecret: text("accessKeySecret"),
    bucket: text("bucket"),
    region: text("region"),
    path: typeof value.path === "string" ? value.path : "/",
  };
}

export class OssSyncProvider implements SyncProvider {
  private readonly client: OSS;
  private readonly prefix: string;
  constructor(
    private readonly config: Config,
    private readonly fetch: typeof globalThis.fetch,
  ) {
    const options = {
      accessKeyId: config.accessKeyId,
      accessKeySecret: config.accessKeySecret,
      bucket: config.bucket,
      region: config.region,
      secure: true,
      urllib: createTransport(fetch),
    };
    this.client = new OSS(options);
    this.prefix = (config.path || "/").replace(/^\/+|\/+$/g, "");
  }
  private key(name: string) {
    return [this.prefix, name.replace(/^\/+/, "")].filter(Boolean).join("/");
  }
  private signedUrl(name: string, method: "GET" | "HEAD") {
    // SDK支持HEAD签名，但当前类型声明的HTTPMethods漏掉了HEAD。
    const sign = this.client.signatureUrl as (
      name: string,
      options: { method: string },
    ) => string;
    return sign.call(this.client, this.key(name), { method });
  }
  async uploadFile(name: string, content: Uint8Array): Promise<boolean> {
    try {
      const result = await this.client.put(
        this.key(name),
        new Blob([new Uint8Array(content)]),
        {
          timeout: 5 * 60 * 1000,
          ...checksumOptions,
          headers: {
            "x-oss-storage-class": "Standard",
            "x-oss-object-acl": "private",
          },
        },
      );
      return result.res.status === 200;
    } catch {
      return false;
    }
  }
  async createFileIfAbsent(
    name: string,
    content: Uint8Array,
  ): Promise<boolean> {
    const versioning = await (
      this.client as OSS & {
        getBucketVersioning(
          bucket: string,
        ): Promise<{ versionStatus?: string }>;
      }
    ).getBucketVersioning(this.config.bucket);
    if (
      versioning.versionStatus === "Enabled" ||
      versioning.versionStatus === "Suspended"
    )
      throw new Error(
        "启用版本控制的 OSS 桶无法保证原子防覆盖，请使用未启用版本控制的同步桶",
      );
    await this.client.put(this.key(name), new Blob([new Uint8Array(content)]), {
      ...checksumOptions,
      headers: { "x-oss-forbid-overwrite": "true" },
    });
    return true;
  }
  async downloadFile(name: string): Promise<Uint8Array> {
    const response = await this.fetch(this.signedUrl(name, "GET"), {
      signal: AbortSignal.timeout(5 * 60 * 1000),
    });
    if (!response.ok)
      throw Object.assign(new Error("OSS读取失败：" + response.status), {
        status: response.status,
      });
    return new Uint8Array(await response.arrayBuffer());
  }
  async fileExists(name: string): Promise<boolean> {
    const response = await this.fetch(this.signedUrl(name, "HEAD"), {
      method: "HEAD",
      signal: AbortSignal.timeout(60000),
    });
    if (response.status === 404) return false;
    if (!response.ok)
      throw Object.assign(new Error("OSS对象检查失败：" + response.status), {
        status: response.status,
      });
    return true;
  }
  async listFiles(prefix?: string): Promise<RemoteFileInfo[]> {
    const fullPrefix = this.key(prefix ?? "").replace(/\/+/g, "/");
    const files: RemoteFileInfo[] = [];
    try {
      let marker: string | undefined;
      do {
        const page = await this.client.list(
          { prefix: fullPrefix || undefined, marker, "max-keys": 1000 },
          {},
        );
        for (const object of page.objects ?? []) {
          if (!object.name || object.name.endsWith("/")) continue;
          const key = object.name.replace(/^\/+/, "");
          const relative =
            this.prefix && key.startsWith(this.prefix + "/")
              ? key.slice(this.prefix.length + 1)
              : key === this.prefix
                ? ""
                : key;
          files.push({
            name: relative.split("/").pop() || relative,
            path: relative,
            size: object.size || 0,
            lastModified: object.lastModified
              ? new Date(object.lastModified).getTime()
              : undefined,
          });
        }
        marker = page.isTruncated ? page.nextMarker : undefined;
      } while (marker);
      return files;
    } catch {
      return [];
    }
  }
}

export function createOssSyncProvider(
  config: JsonValue,
  fetch: typeof globalThis.fetch,
) {
  return new OssSyncProvider(parse(config), fetch);
}
