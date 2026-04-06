import { KMSClient, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import { KeyProvider, KeyRecord, Status, KeyNotFoundError } from "./provider";

export interface AwsKmsProviderOptions {
  keyId: string;
  region?: string;
  endpoint?: string;
  client?: KMSClient;
}

export class AwsKmsProvider implements KeyProvider {
  private readonly keyId: string;
  private readonly client: KMSClient;
  private readonly cache = new Map<string, KeyRecord>();

  constructor({ keyId, region = "us-east-1", endpoint, client }: AwsKmsProviderOptions) {
    this.keyId = keyId;
    this.client =
      client ??
      new KMSClient({
        region,
        ...(endpoint ? { endpoint } : {}),
      });
  }

  private async generate(ref: string): Promise<KeyRecord> {
    const cmd = new GenerateDataKeyCommand({
      KeyId: this.keyId,
      KeySpec: "AES_256",
      EncryptionContext: { "cyphera:ref": ref },
    });
    let resp;
    try {
      resp = await this.client.send(cmd);
    } catch {
      throw new KeyNotFoundError(ref);
    }
    return {
      ref,
      version: 1,
      status: Status.Active,
      algorithm: "aes256",
      material: Buffer.from(resp.Plaintext!),
      tweak: null,
      metadata: {},
      createdAt: null,
    };
  }

  async resolve(ref: string): Promise<KeyRecord> {
    if (!this.cache.has(ref)) {
      this.cache.set(ref, await this.generate(ref));
    }
    return this.cache.get(ref)!;
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    if (version !== 1) throw new KeyNotFoundError(ref, version);
    return this.resolve(ref);
  }
}
