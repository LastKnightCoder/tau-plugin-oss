import { useState } from "react";
import { definePlugin, type PluginSettingsProps } from "@tau/plugins";
import { Button, Input, SettingRow } from "@tau/ui";
import { createOssSyncProvider } from "./sync";

declare const __PLUGIN_META__: { id: string; name: string; version: string };

function OssSettings({ syncConfig }: PluginSettingsProps) {
  const value = syncConfig?.value;
  const fields =
    value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const [config, setConfig] = useState(() => ({
    bucket: String(fields.bucket ?? ""),
    region: String(fields.region ?? ""),
    path: String(fields.path ?? "/"),
    accessKeyId: String(fields.accessKeyId ?? ""),
    accessKeySecret: String(fields.accessKeySecret ?? ""),
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!syncConfig) return <p>请在客户端的同步设置中配置此插件。</p>;

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await syncConfig.save(config);
      setSaved(true);
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <SettingRow title="Bucket" description="同步存储桶名称">
        <Input
          className="w-[260px]"
          aria-label="Bucket"
          type="text"
          value={config.bucket}
          placeholder="同步存储桶"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, bucket: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="Region" description="存储区域，例如 oss-cn-hangzhou">
        <Input
          className="w-[260px]"
          aria-label="Region"
          type="text"
          value={config.region}
          placeholder="oss-cn-hangzhou"
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, region: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="路径前缀" description="可选，留空表示根目录">
        <Input
          className="w-[260px]"
          aria-label="路径前缀"
          type="text"
          value={config.path}
          placeholder="/"
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, path: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="Access Key ID" description="从阿里云控制台获取">
        <Input
          className="w-[260px]"
          aria-label="Access Key ID"
          type="text"
          value={config.accessKeyId}
          placeholder=""
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, accessKeyId: event.target.value });
          }}
        />
      </SettingRow>

      <SettingRow title="Access Key Secret" description="请妥善保管，不要泄露">
        <Input
          className="w-[260px]"
          aria-label="Access Key Secret"
          type="password"
          value={config.accessKeySecret}
          placeholder=""
          required
          autoComplete="off"
          spellCheck={false}
          disabled={saving}
          onChange={(event) => {
            setSaved(false);
            setConfig({ ...config, accessKeySecret: event.target.value });
          }}
        />
      </SettingRow>

      {error && (
        <SettingRow title="">
          <p role="alert" className="text-danger text-tau-body">
            {error}
          </p>
        </SettingRow>
      )}
      {saved && (
        <SettingRow title="">
          <p role="status" className="text-ink-2 text-tau-body">
            配置已保存，可以使用客户端的检查、上传和下载。
          </p>
        </SettingRow>
      )}

      <SettingRow title="">
        <Button onClick={handleSave} loading={saving} loadingText="保存中…">
          保存同步配置
        </Button>
      </SettingRow>
    </>
  );
}

export default definePlugin({
  ...__PLUGIN_META__,
  create: () => ({
    activate(context) {
      context.sync.register({
        id: context.pluginId,
        name: "阿里云 OSS",
        create: (config) => createOssSyncProvider(config, context.fetch),
      });
      context.settings.register({
        id: "sync",
        title: "阿里云 OSS 同步存储",
        target: "sync",
        component: OssSettings,
      });
    },
  }),
});
