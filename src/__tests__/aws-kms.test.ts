import { AwsKmsProvider } from "../aws-kms";
import { KeyNotFoundError, Status } from "../provider";

const FAKE_PLAINTEXT = Buffer.alloc(32, 0xaa);
const KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/test";

function makeMockClient(plaintext: Buffer = FAKE_PLAINTEXT) {
  return {
    send: jest.fn().mockResolvedValue({
      Plaintext: plaintext,
      CiphertextBlob: Buffer.alloc(64, 0xbb),
      KeyId: KEY_ID,
    }),
  };
}

describe("AwsKmsProvider", () => {
  describe("resolve", () => {
    it("returns an active key record", async () => {
      const client = makeMockClient();
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: client as any });
      const rec = await provider.resolve("customer-primary");
      expect(rec.ref).toBe("customer-primary");
      expect(rec.version).toBe(1);
      expect(rec.status).toBe(Status.Active);
      expect(rec.material).toEqual(FAKE_PLAINTEXT);
    });

    it("algorithm is aes256", async () => {
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: makeMockClient() as any });
      const rec = await provider.resolve("k");
      expect(rec.algorithm).toBe("aes256");
    });

    it("caches the result", async () => {
      const client = makeMockClient();
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: client as any });
      await provider.resolve("key-a");
      await provider.resolve("key-a");
      expect(client.send).toHaveBeenCalledTimes(1);
    });

    it("different refs get separate calls", async () => {
      const client = makeMockClient();
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: client as any });
      await provider.resolve("key-a");
      await provider.resolve("key-b");
      expect(client.send).toHaveBeenCalledTimes(2);
    });

    it("throws KeyNotFoundError on SDK error", async () => {
      const client = { send: jest.fn().mockRejectedValue(new Error("NotFound")) };
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: client as any });
      await expect(provider.resolve("bad")).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });

  describe("resolveVersion", () => {
    it("version 1 resolves", async () => {
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: makeMockClient() as any });
      const rec = await provider.resolveVersion("customer-primary", 1);
      expect(rec.version).toBe(1);
    });

    it("other versions throw KeyNotFoundError", async () => {
      const provider = new AwsKmsProvider({ keyId: KEY_ID, client: makeMockClient() as any });
      await expect(provider.resolveVersion("customer-primary", 2)).rejects.toBeInstanceOf(
        KeyNotFoundError
      );
    });
  });
});
