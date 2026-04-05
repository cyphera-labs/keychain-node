import { KeyProvider, KeyRecord, Status, KeyNotFoundError } from "./provider";

function decodeBytes(s: string): Buffer {
  // Try hex first: must be even length and all hex chars
  if (s.length % 2 === 0 && /^[0-9a-fA-F]+$/.test(s)) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "base64");
}

function normalizeRef(ref: string): string {
  return ref.toUpperCase().replace(/-/g, "_");
}

export class EnvProvider implements KeyProvider {
  private prefix: string;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  private getKeyEnvVar(ref: string): string {
    return `${this.prefix}_${normalizeRef(ref)}_KEY`;
  }

  private getTweakEnvVar(ref: string): string {
    return `${this.prefix}_${normalizeRef(ref)}_TWEAK`;
  }

  private buildRecord(ref: string): KeyRecord {
    const keyVar = this.getKeyEnvVar(ref);
    const keyVal = process.env[keyVar];
    if (!keyVal) {
      throw new KeyNotFoundError(ref);
    }

    const tweakVar = this.getTweakEnvVar(ref);
    const tweakVal = process.env[tweakVar];
    const tweak = tweakVal ? decodeBytes(tweakVal) : null;

    return {
      ref,
      version: 1,
      status: Status.Active,
      algorithm: "",
      material: decodeBytes(keyVal),
      tweak,
      metadata: {},
      createdAt: null,
    };
  }

  async resolve(ref: string): Promise<KeyRecord> {
    return this.buildRecord(ref);
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    if (version !== 1) {
      throw new KeyNotFoundError(ref, version);
    }
    return this.buildRecord(ref);
  }
}
