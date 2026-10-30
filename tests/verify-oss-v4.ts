import { createHash, createHmac } from "node:crypto";
import type { IncomingMessage } from "node:http";

/** 独立核验请求头与预签名 URL，不调用 SDK 的签名实现。 */
export function verifyOssV4(request: IncomingMessage, bucket: string, region: string): boolean {
  const url = new URL(request.url ?? "/", "http://localhost");
  const header = /^OSS4-HMAC-SHA256 Credential=([^,]+),Signature=([a-f0-9]{64})$/.exec(
    request.headers.authorization ?? ""
  );
  const credential = header?.[1] ?? url.searchParams.get("x-oss-credential");
  const signature = header?.[2] ?? url.searchParams.get("x-oss-signature");
  if (!credential || !signature) return false;
  const [keyId, date, signRegion, service, suffix] = credential.split("/");
  const timestamp = request.headers["x-oss-date"] ?? url.searchParams.get("x-oss-date");
  if (
    keyId !== "test-key" || signRegion !== region || service !== "oss" ||
    suffix !== "aliyun_v4_request" || typeof timestamp !== "string" ||
    !/^\d{8}T\d{6}Z$/.test(timestamp) || timestamp.slice(0, 8) !== date
  ) return false;
  if (!header) {
    if (url.searchParams.get("x-oss-signature-version") !== "OSS4-HMAC-SHA256") return false;
    const expires = Number(url.searchParams.get("x-oss-expires"));
    const issuedAt = Date.parse(timestamp.replace(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/,
      "$1-$2-$3T$4:$5:$6Z"
    ));
    if (!(expires > 0 && expires <= 604800) || Date.now() > issuedAt + expires * 1000) return false;
  }
  const encode = (value: string) => encodeURIComponent(value).replace(
    /[!'()*]/g, char => "%" + char.charCodeAt(0).toString(16).toUpperCase()
  );
  const query = [...url.searchParams]
    .filter(([key]) => key !== "x-oss-signature")
    .map(([key, value]) => [encode(key), encode(value)])
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, value]) => value ? `${key}=${value}` : key)
    .join("&");
  const canonicalHeaders = Object.keys(request.headers)
    .filter(key => key === "content-type" || key === "content-md5" || key.startsWith("x-oss-"))
    .sort()
    .map(key => `${key}:${String(request.headers[key]).trim()}\n`)
    .join("");
  const canonical = [
    request.method,
    ["", bucket, ...decodeURIComponent(url.pathname).slice(1).split("/")].map(encode).join("/"),
    query,
    canonicalHeaders,
    "",
    request.headers["x-oss-content-sha256"] ?? "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "OSS4-HMAC-SHA256", timestamp, `${date}/${region}/oss/aliyun_v4_request`,
    createHash("sha256").update(canonical).digest("hex"),
  ].join("\n");
  let signingKey: Buffer = Buffer.from("aliyun_v4test-secret");
  for (const value of [date, region, "oss", "aliyun_v4_request"])
    signingKey = createHmac("sha256", signingKey).update(value).digest();
  return createHmac("sha256", signingKey).update(stringToSign).digest("hex") === signature;
}
