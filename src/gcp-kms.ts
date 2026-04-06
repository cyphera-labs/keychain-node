import { KeyManagementServiceClient } from "@google-cloud/kms";
import { randomBytes } from "crypto";
import { KeyProvider, KeyRecord, Status, KeyNotFoundError } from "./provider";

export interface GcpKmsProviderOptions {
  keyName: string;
  client?: KeyManagementServiceClient;
}

export class GcpKmsProvider implements KeyProvider {
  private readonly keyName: string;
  private readonly client: KeyManagementServiceClient;
  private readonly plaintextCache = new Map<string, Buffer>();

  constructor({ keyName, client }: GcpKmsProviderOptions) {
    this.keyName = keyName;
    this.client = client ?? new KeyManagementServiceClient();
  }

  private async wrapNewKey(ref: string): Promise<Buffer> {
    const plaintext = randomBytes(32);
    try {
      await this.client.encrypt({
        name: this.keyName,
        plaintext,
        additionalAuthenticatedData: Buffer.from(ref),
      });
    } catch {
      throw new KeyNotFoundError(ref);
    }
    return plaintext;
  }

  async resolve(ref: string): Promise<KeyRecord> {
    if (!this.plaintextCache.has(ref)) {
      const material = await this.wrapNewKey(ref);
      this.plaintextCache.set(ref, material);
    }
    return {
      ref,
      version: 1,
      status: Status.Active,
      algorithm: "aes256",
      material: this.plaintextCache.get(ref)!,
      tweak: null,
      metadata: {},
      createdAt: null,
    };
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    if (version !== 1) throw new KeyNotFoundError(ref, version);
    return this.resolve(ref);
  }
}
