import type { PluginSettingsProps } from "@tau/plugins";
import { ConfigurationPanel, type ConfigurationField } from "@tau/ui";

const accountFields: readonly ConfigurationField[] = [
  {
    key: "accessKeyId",
    label: "Access Key ID",
  },
  {
    key: "accessKeySecret",
    label: "Access Key Secret",
    type: "password",
  },
];
const fields: readonly ConfigurationField[] = [
  {
    key: "bucket",
    label: "Bucket",
    placeholder: "必填",
  },
  {
    key: "region",
    label: "Region",
    placeholder: "例如 oss-cn-hangzhou",
  },
  {
    key: "path",
    label: "目录",
    placeholder: "sync（可选）",
  },
];

export function MobileSettings(props: PluginSettingsProps) {
  const config = props.syncConfig ?? props.uploadConfig;
  if (!config) return <p>请从客户端对应的服务设置进入。</p>;
  const initialValue: Record<string, string> = { urlStyle: "path" };
  if (config.value && typeof config.value === "object" && !Array.isArray(config.value))
    for (const [key, value] of Object.entries(config.value))
      if (typeof value === "string") initialValue[key] = value;
  return (
    <ConfigurationPanel
      initialValue={initialValue}
      accountFields={accountFields}
      fields={fields}
      onSave={value =>
        config.save({
          ...(config.value && typeof config.value === "object" && !Array.isArray(config.value)
            ? config.value
            : {}),
          ...value,
        })
      }
    />
  );
}
