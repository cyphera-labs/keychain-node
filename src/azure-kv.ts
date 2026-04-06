import { KeyClient } from "@azure/keyvault-keys";
import { CryptographyClient, KeyWrapAlgorithm } from "@azure/keyvault-keys";
import { DefaultAzureCredential, TokenCredential } from "@azure/identity";
import { randomBytes } from "crypto";
import { KeyProvider, KeyRecord, Status, KeyNotFoundError } from "./provider";

export interface AzureKvProviderOptions {
  vaultUrl: string;
  keyName: string;
  credential?: TokenCredential;
  keyClient?: KeyClient;
}

export class AzureKvProvider implements KeyProvider {
  private readonly keyName: string;
  private readonly keyClient: KeyClient;
  private readonly credential: TokenCredential;
  private readonly plaintextCache = new Map<string, Buffer>();

  constructor({ vaultUrl, keyName, credential, keyClient }: AzureKvProviderOptions) {
    this.keyName = keyName;
    this.credential = credential ?? new DefaultAzureCredential();
    this.keyClient = keyClient ?? new KeyClient(vaultUrl, this.credential);
  }

  private async wrapNewKey(): Promise<Buffer> {
    const plaintext = randomBytes(32);
    const key = await this.keyClient.getKey(this.keyName);
    const cryptoClient = new CryptographyClient(key, this.credential);
    await cryptoClient.wrapKey("RSA-OAEP" as KeyWrapAlgorithm, plaintext);
    return plaintext;
  }

  async resolve(ref: string): Promise<KeyRecord> {
    if (!this.plaintextCache.has(ref)) {
      let material: Buffer;
      try {
        material = await this.wrapNewKey();
      } catch {
        throw new KeyNotFoundError(ref);
      }
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
