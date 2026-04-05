import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { FileProvider, Status, KeyNotFoundError, KeyDisabledError, NoActiveKeyError } from "../index";

function writeTempKeyFile(keys: object[]): string {
  const tmpDir = os.tmpdir();
  const tmpFile = path.join(tmpDir, `keychain-test-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(tmpFile, JSON.stringify({ keys }), "utf-8");
  return tmpFile;
}

const HEX_MATERIAL = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

describe("FileProvider", () => {
  let tmpFiles: string[] = [];

  afterEach(() => {
    tmpFiles.forEach((f) => {
      try { fs.unlinkSync(f); } catch { /* ignore */ }
    });
    tmpFiles = [];
  });

  it("loads from JSON and resolves an active key", async () => {
    const tmpFile = writeTempKeyFile([
      {
        ref: "customer-primary",
        version: 1,
        status: "active",
        algorithm: "aes256",
        material: HEX_MATERIAL,
      },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    const record = await provider.resolve("customer-primary");
    expect(record.ref).toBe("customer-primary");
    expect(record.version).toBe(1);
    expect(record.status).toBe(Status.Active);
    expect(record.material).toEqual(Buffer.from(HEX_MATERIAL, "hex"));
    expect(record.tweak).toBeNull();
  });

  it("resolveVersion returns the correct version", async () => {
    const tmpFile = writeTempKeyFile([
      { ref: "my-key", version: 1, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
      { ref: "my-key", version: 2, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    const record = await provider.resolveVersion("my-key", 1);
    expect(record.version).toBe(1);
  });

  it("resolve returns highest version active key when multiple exist", async () => {
    const tmpFile = writeTempKeyFile([
      { ref: "my-key", version: 1, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
      { ref: "my-key", version: 2, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
      { ref: "my-key", version: 3, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    const record = await provider.resolve("my-key");
    expect(record.version).toBe(3);
  });

  it("missing ref throws KeyNotFoundError", async () => {
    const tmpFile = writeTempKeyFile([
      { ref: "other-key", version: 1, status: "active", algorithm: "aes256", material: HEX_MATERIAL },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    await expect(provider.resolve("does-not-exist")).rejects.toThrow(KeyNotFoundError);
  });

  it("resolveVersion on a disabled key throws KeyDisabledError", async () => {
    const tmpFile = writeTempKeyFile([
      { ref: "my-key", version: 1, status: "disabled", algorithm: "aes256", material: HEX_MATERIAL },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    await expect(provider.resolveVersion("my-key", 1)).rejects.toThrow(KeyDisabledError);
  });

  it("no active key throws NoActiveKeyError", async () => {
    const tmpFile = writeTempKeyFile([
      { ref: "my-key", version: 1, status: "disabled", algorithm: "aes256", material: HEX_MATERIAL },
      { ref: "my-key", version: 2, status: "deprecated", algorithm: "aes256", material: HEX_MATERIAL },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    await expect(provider.resolve("my-key")).rejects.toThrow(NoActiveKeyError);
  });

  it("parses tweak from the key file", async () => {
    const tmpFile = writeTempKeyFile([
      {
        ref: "my-key",
        version: 1,
        status: "active",
        algorithm: "aes256",
        material: HEX_MATERIAL,
        tweak: "deadbeef",
      },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    const record = await provider.resolve("my-key");
    expect(record.tweak).toEqual(Buffer.from("deadbeef", "hex"));
  });

  it("parses metadata and created_at from the key file", async () => {
    const tmpFile = writeTempKeyFile([
      {
        ref: "my-key",
        version: 1,
        status: "active",
        algorithm: "aes256",
        material: HEX_MATERIAL,
        metadata: { owner: "team-a" },
        created_at: "2024-01-15T00:00:00Z",
      },
    ]);
    tmpFiles.push(tmpFile);

    const provider = new FileProvider(tmpFile);
    const record = await provider.resolve("my-key");
    expect(record.metadata).toEqual({ owner: "team-a" });
    expect(record.createdAt).toEqual(new Date("2024-01-15T00:00:00Z"));
  });
});
