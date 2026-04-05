import { EnvProvider, Status, KeyNotFoundError } from "../index";

const HEX_KEY = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
const BASE64_KEY = "ABEiM0RVZneImaq7zN3u/w==";
const HEX_TWEAK = "deadbeef";

describe("EnvProvider", () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save any existing values
    [
      "CYPHERA_CUSTOMER_PRIMARY_KEY",
      "CYPHERA_CUSTOMER_PRIMARY_TWEAK",
      "CYPHERA_SOME_REF_KEY",
    ].forEach((k) => {
      savedEnv[k] = process.env[k];
    });
  });

  afterEach(() => {
    // Restore
    Object.entries(savedEnv).forEach(([k, v]) => {
      if (v === undefined) {
        delete process.env[k];
      } else {
        process.env[k] = v;
      }
    });
  });

  it("resolve returns a record from a hex-encoded key", async () => {
    process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"] = HEX_KEY;
    const provider = new EnvProvider("CYPHERA");
    const record = await provider.resolve("customer-primary");
    expect(record.ref).toBe("customer-primary");
    expect(record.version).toBe(1);
    expect(record.status).toBe(Status.Active);
    expect(record.material).toEqual(Buffer.from(HEX_KEY, "hex"));
    expect(record.tweak).toBeNull();
  });

  it("resolve returns a record from a base64-encoded key", async () => {
    process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"] = BASE64_KEY;
    const provider = new EnvProvider("CYPHERA");
    const record = await provider.resolve("customer-primary");
    expect(record.material).toEqual(Buffer.from(BASE64_KEY, "base64"));
  });

  it("resolve throws KeyNotFoundError when env var is missing", async () => {
    delete process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"];
    const provider = new EnvProvider("CYPHERA");
    await expect(provider.resolve("customer-primary")).rejects.toThrow(KeyNotFoundError);
  });

  it("resolveVersion(1) returns the record successfully", async () => {
    process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"] = HEX_KEY;
    const provider = new EnvProvider("CYPHERA");
    const record = await provider.resolveVersion("customer-primary", 1);
    expect(record.version).toBe(1);
    expect(record.material).toEqual(Buffer.from(HEX_KEY, "hex"));
  });

  it("resolveVersion(2) throws KeyNotFoundError (only version 1 exists)", async () => {
    process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"] = HEX_KEY;
    const provider = new EnvProvider("CYPHERA");
    await expect(provider.resolveVersion("customer-primary", 2)).rejects.toThrow(KeyNotFoundError);
  });

  it("tweak is read when the tweak env var is set", async () => {
    process.env["CYPHERA_CUSTOMER_PRIMARY_KEY"] = HEX_KEY;
    process.env["CYPHERA_CUSTOMER_PRIMARY_TWEAK"] = HEX_TWEAK;
    const provider = new EnvProvider("CYPHERA");
    const record = await provider.resolve("customer-primary");
    expect(record.tweak).toEqual(Buffer.from(HEX_TWEAK, "hex"));
  });

  it("normalizes ref with underscores in env var name", async () => {
    process.env["CYPHERA_SOME_REF_KEY"] = HEX_KEY;
    const provider = new EnvProvider("CYPHERA");
    const record = await provider.resolve("some-ref");
    expect(record.ref).toBe("some-ref");
    expect(record.material).toEqual(Buffer.from(HEX_KEY, "hex"));
  });
});
