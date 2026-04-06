import { AzureKvProvider } from "../azure-kv";
import { KeyNotFoundError, Status } from "../provider";

const VAULT_URL = "https://test-vault.vault.azure.net";
const KEY_NAME = "test-rsa-key";

function makeMockKeyClient(failGetKey = false) {
  const mockKey = { id: "key-id", name: KEY_NAME };
  return {
    getKey: failGetKey
      ? jest.fn().mockRejectedValue(new Error("not found"))
      : jest.fn().mockResolvedValue(mockKey),
  };
}

function makeMockCryptoClient() {
  return {
    wrapKey: jest.fn().mockResolvedValue({ encryptedKey: Buffer.alloc(64, 0xdd) }),
  };
}

// Patch CryptographyClient constructor
jest.mock("@azure/keyvault-keys", () => {
  const actual = jest.requireActual("@azure/keyvault-keys");
  return {
    ...actual,
    CryptographyClient: jest.fn().mockImplementation(() => makeMockCryptoClient()),
  };
});

describe("AzureKvProvider", () => {
  describe("resolve", () => {
    it("returns an active key record", async () => {
      const provider = new AzureKvProvider({
        vaultUrl: VAULT_URL,
        keyName: KEY_NAME,
        credential: {} as any,
        keyClient: makeMockKeyClient() as any,
      });
      const rec = await provider.resolve("customer-primary");
      expect(rec.ref).toBe("customer-primary");
      expect(rec.version).toBe(1);
      expect(rec.status).toBe(Status.Active);
      expect(rec.material).toHaveLength(32);
    });

    it("caches result", async () => {
      const keyClient = makeMockKeyClient();
      const provider = new AzureKvProvider({
        vaultUrl: VAULT_URL,
        keyName: KEY_NAME,
        credential: {} as any,
        keyClient: keyClient as any,
      });
      const r1 = await provider.resolve("k");
      const r2 = await provider.resolve("k");
      expect(r1.material).toEqual(r2.material);
    });

    it("throws KeyNotFoundError when key not found", async () => {
      const provider = new AzureKvProvider({
        vaultUrl: VAULT_URL,
        keyName: KEY_NAME,
        credential: {} as any,
        keyClient: makeMockKeyClient(true) as any,
      });
      await expect(provider.resolve("bad")).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });

  describe("resolveVersion", () => {
    it("version 1 resolves", async () => {
      const provider = new AzureKvProvider({
        vaultUrl: VAULT_URL,
        keyName: KEY_NAME,
        credential: {} as any,
        keyClient: makeMockKeyClient() as any,
      });
      const rec = await provider.resolveVersion("k", 1);
      expect(rec.version).toBe(1);
    });

    it("other versions throw", async () => {
      const provider = new AzureKvProvider({
        vaultUrl: VAULT_URL,
        keyName: KEY_NAME,
        credential: {} as any,
        keyClient: makeMockKeyClient() as any,
      });
      await expect(provider.resolveVersion("k", 2)).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });
});
