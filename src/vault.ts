import { KeyProvider, KeyRecord, Status, KeyNotFoundError, KeyDisabledError, NoActiveKeyError } from "./provider";

export interface VaultProviderOptions {
  url?: string;
  token: string;
  mount?: string;
}

interface VaultSecretData {
  version?: number | string;
  status?: string;
  algorithm?: string;
  material?: string;
  tweak?: string;
  metadata?: Record<string, string>;
  versions?: VaultSecretData[] | string;
  ref?: string;
}

function decodeBytes(value: string): Buffer {
  const s = value.trim();
  if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "base64");
}

export class VaultProvider implements KeyProvider {
  private readonly url: string;
  private readonly token: string;
  private readonly mount: string;

  constructor({ url = "http://127.0.0.1:8200", token, mount = "secret" }: VaultProviderOptions) {
    this.url = url;
    this.token = token;
    this.mount = mount;
  }

  private async readSecret(ref: string): Promise<VaultSecretData> {
    const response = await fetch(`${this.url}/v1/${this.mount}/data/${ref}`, {
      headers: {
        "X-Vault-Token": this.token,
        "Content-Type": "application/json",
      },
    });
    if (response.status === 404) throw new KeyNotFoundError(ref);
    if (!response.ok) throw new KeyNotFoundError(ref);
    const body = (await response.json()) as { data: { data: VaultSecretData } };
    return body.data.data;
  }

  private parseRecord(ref: string, data: VaultSecretData): KeyRecord {
    const materialRaw = data.material ?? "";
    const material = materialRaw ? decodeBytes(materialRaw) : Buffer.alloc(0);
    const tweak = data.tweak ? decodeBytes(data.tweak) : null;
    const statusStr = (data.status ?? "active").toLowerCase();
    const status =
      statusStr === "deprecated"
        ? Status.Deprecated
        : statusStr === "disabled"
        ? Status.Disabled
        : Status.Active;
    return {
      ref: data.ref ?? ref,
      version: Number(data.version ?? 1),
      status,
      algorithm: data.algorithm ?? "adf1",
      material,
      tweak,
      metadata: data.metadata ?? {},
      createdAt: null,
    };
  }

  private parseRecords(ref: string, data: VaultSecretData): KeyRecord[] {
    if (data.versions) {
      const versions: VaultSecretData[] =
        typeof data.versions === "string" ? JSON.parse(data.versions) : data.versions;
      return versions.map((v) => this.parseRecord(ref, v));
    }
    return [this.parseRecord(ref, data)];
  }

  async resolve(ref: string): Promise<KeyRecord> {
    const data = await this.readSecret(ref);
    const records = this.parseRecords(ref, data);
    const active = records.filter((r) => r.status === Status.Active);
    if (active.length === 0) throw new NoActiveKeyError(ref);
    return active.reduce((best, r) => (r.version > best.version ? r : best));
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    const data = await this.readSecret(ref);
    const records = this.parseRecords(ref, data);
    const record = records.find((r) => r.version === version);
    if (!record) throw new KeyNotFoundError(ref, version);
    if (record.status === Status.Disabled) throw new KeyDisabledError(ref, version);
    return record;
  }
}
