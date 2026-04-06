import { GcpKmsProvider } from "../gcp-kms";
import { KeyNotFoundError, Status } from "../provider";

const KEY_NAME =
  "projects/test-project/locations/global/keyRings/test-ring/cryptoKeys/test-key";

function makeMockClient() {
  return {
    encrypt: jest.fn().mockResolvedValue([{ ciphertext: Buffer.alloc(64, 0xcc) }]),
  };
}

describe("GcpKmsProvider", () => {
  describe("resolve", () => {
    it("returns an active key record", async () => {
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: makeMockClient() as any });
      const rec = await provider.resolve("customer-primary");
      expect(rec.ref).toBe("customer-primary");
      expect(rec.version).toBe(1);
      expect(rec.status).toBe(Status.Active);
      expect(rec.material).toHaveLength(32);
    });

    it("calls encrypt with correct params", async () => {
      const client = makeMockClient();
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: client as any });
      await provider.resolve("customer-primary");
      expect(client.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: KEY_NAME,
          additionalAuthenticatedData: Buffer.from("customer-primary"),
        })
      );
    });

    it("caches result", async () => {
      const client = makeMockClient();
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: client as any });
      const r1 = await provider.resolve("k");
      const r2 = await provider.resolve("k");
      expect(r1.material).toEqual(r2.material);
      expect(client.encrypt).toHaveBeenCalledTimes(1);
    });

    it("throws KeyNotFoundError on error", async () => {
      const client = { encrypt: jest.fn().mockRejectedValue(new Error("API error")) };
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: client as any });
      await expect(provider.resolve("bad")).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });

  describe("resolveVersion", () => {
    it("version 1 resolves", async () => {
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: makeMockClient() as any });
      const rec = await provider.resolveVersion("k", 1);
      expect(rec.version).toBe(1);
    });

    it("other versions throw", async () => {
      const provider = new GcpKmsProvider({ keyName: KEY_NAME, client: makeMockClient() as any });
      await expect(provider.resolveVersion("k", 2)).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });
});
