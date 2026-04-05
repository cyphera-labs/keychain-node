import * as fs from "fs";
import {
  KeyProvider,
  KeyRecord,
  Status,
  KeyNotFoundError,
  KeyDisabledError,
  NoActiveKeyError,
} from "./provider";

interface RawKeyEntry {
  ref: string;
  version: number;
  status: string;
  algorithm?: string;
  material: string;
  tweak?: string;
  metadata?: Record<string, string>;
  created_at?: string | null;
}

interface KeyFile {
  keys: RawKeyEntry[];
}

function decodeBytes(s: string): Buffer {
  // Try hex first: must be even length and all hex chars
  if (s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "base64");
}

function parseStatus(s: string): Status {
  switch (s) {
    case "active":
      return Status.Active;
    case "deprecated":
      return Status.Deprecated;
    case "disabled":
      return Status.Disabled;
    default:
      return Status.Active;
  }
}

function rawToKeyRecord(raw: RawKeyEntry): KeyRecord {
  return {
    ref: raw.ref,
    version: raw.version,
    status: parseStatus(raw.status),
    algorithm: raw.algorithm ?? "",
    material: decodeBytes(raw.material),
    tweak: raw.tweak ? decodeBytes(raw.tweak) : null,
    metadata: raw.metadata ?? {},
    createdAt: raw.created_at ? new Date(raw.created_at) : null,
  };
}

export class FileProvider implements KeyProvider {
  private records: KeyRecord[];

  constructor(path: string) {
    const raw = fs.readFileSync(path, "utf-8");
    const parsed: KeyFile = JSON.parse(raw);
    this.records = parsed.keys
      .map(rawToKeyRecord)
      .sort((a, b) => b.version - a.version);
  }

  async resolve(ref: string): Promise<KeyRecord> {
    const matching = this.records.filter(
      (r) => r.ref === ref && r.status === Status.Active
    );
    if (matching.length === 0) {
      const anyForRef = this.records.some((r) => r.ref === ref);
      if (!anyForRef) {
        throw new KeyNotFoundError(ref);
      }
      throw new NoActiveKeyError(ref);
    }
    return matching[0];
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    const record = this.records.find(
      (r) => r.ref === ref && r.version === version
    );
    if (!record) {
      throw new KeyNotFoundError(ref, version);
    }
    if (record.status === Status.Disabled) {
      throw new KeyDisabledError(ref, version);
    }
    return record;
  }
}
