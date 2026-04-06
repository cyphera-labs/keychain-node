import { VaultProvider } from "../vault";
import { KeyDisabledError, KeyNotFoundError, NoActiveKeyError, Status } from "../provider";

const MATERIAL_HEX = "aa".repeat(32);
const MATERIAL_BYTES = Buffer.from(MATERIAL_HEX, "hex");

function mockFetch(data: object, status = 200) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () =>
      Promise.resolve({
        data: { data },
      }),
  }) as any;
}

function mockFetchNotFound() {
  global.fetch = jest.fn().mockResolvedValue({
    ok: false,
    status: 404,
    json: () => Promise.resolve({}),
  }) as any;
}

describe("VaultProvider", () => {
  const provider = new VaultProvider({ token: "root" });

  describe("resolve", () => {
    it("returns active record", async () => {
      mockFetch({ version: 1, status: "active", algorithm: "adf1", material: MATERIAL_HEX });
      const rec = await provider.resolve("customer-primary");
      expect(rec.ref).toBe("customer-primary");
      expect(rec.status).toBe(Status.Active);
      expect(rec.material).toEqual(MATERIAL_BYTES);
    });

    it("throws NoActiveKeyError when none active", async () => {
      mockFetch({ version: 1, status: "disabled", algorithm: "adf1", material: MATERIAL_HEX });
      await expect(provider.resolve("k")).rejects.toBeInstanceOf(NoActiveKeyError);
    });

    it("throws KeyNotFoundError on 404", async () => {
      mockFetchNotFound();
      await expect(provider.resolve("missing")).rejects.toBeInstanceOf(KeyNotFoundError);
    });

    it("returns highest active version", async () => {
      mockFetch({
        versions: JSON.stringify([
          { version: 2, status: "active", algorithm: "adf1", material: MATERIAL_HEX },
          { version: 1, status: "deprecated", algorithm: "adf1", material: MATERIAL_HEX },
        ]),
      });
      const rec = await provider.resolve("k");
      expect(rec.version).toBe(2);
    });
  });

  describe("resolveVersion", () => {
    it("returns specific version", async () => {
      mockFetch({
        versions: JSON.stringify([
          { version: 2, status: "active", algorithm: "adf1", material: MATERIAL_HEX },
          { version: 1, status: "deprecated", algorithm: "adf1", material: MATERIAL_HEX },
        ]),
      });
      const rec = await provider.resolveVersion("k", 1);
      expect(rec.version).toBe(1);
      expect(rec.status).toBe(Status.Deprecated);
    });

    it("throws KeyDisabledError for disabled version", async () => {
      mockFetch({ version: 1, status: "disabled", algorithm: "adf1", material: MATERIAL_HEX });
      await expect(provider.resolveVersion("k", 1)).rejects.toBeInstanceOf(KeyDisabledError);
    });

    it("throws KeyNotFoundError for missing version", async () => {
      mockFetch({ version: 1, status: "active", algorithm: "adf1", material: MATERIAL_HEX });
      await expect(provider.resolveVersion("k", 99)).rejects.toBeInstanceOf(KeyNotFoundError);
    });
  });
});
