import { MemoryProvider, Status, KeyNotFoundError, KeyDisabledError, NoActiveKeyError } from "../index";

const makeRecord = (ref: string, version: number, status: Status) => ({
  ref,
  version,
  status,
  algorithm: "aes256",
  material: Buffer.from("00112233445566778899aabbccddeeff", "hex"),
  tweak: null,
  metadata: {},
  createdAt: null,
});

describe("MemoryProvider", () => {
  it("resolve returns the highest active version", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Active),
      makeRecord("my-key", 2, Status.Active),
      makeRecord("my-key", 3, Status.Active),
    ]);
    const record = await provider.resolve("my-key");
    expect(record.version).toBe(3);
  });

  it("resolve skips deprecated/disabled versions and returns highest active", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Active),
      makeRecord("my-key", 2, Status.Deprecated),
      makeRecord("my-key", 3, Status.Disabled),
    ]);
    const record = await provider.resolve("my-key");
    expect(record.version).toBe(1);
    expect(record.status).toBe(Status.Active);
  });

  it("resolveVersion returns the specific version", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Active),
      makeRecord("my-key", 2, Status.Active),
    ]);
    const record = await provider.resolveVersion("my-key", 1);
    expect(record.version).toBe(1);
  });

  it("resolveVersion on a disabled key throws KeyDisabledError", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Disabled),
    ]);
    await expect(provider.resolveVersion("my-key", 1)).rejects.toThrow(KeyDisabledError);
  });

  it("resolveVersion on a missing ref throws KeyNotFoundError", async () => {
    const provider = new MemoryProvider([]);
    await expect(provider.resolveVersion("does-not-exist", 1)).rejects.toThrow(KeyNotFoundError);
  });

  it("resolve with no active versions throws NoActiveKeyError", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Disabled),
      makeRecord("my-key", 2, Status.Deprecated),
    ]);
    await expect(provider.resolve("my-key")).rejects.toThrow(NoActiveKeyError);
  });

  it("resolve on unknown ref throws KeyNotFoundError", async () => {
    const provider = new MemoryProvider([]);
    await expect(provider.resolve("ghost")).rejects.toThrow(KeyNotFoundError);
  });

  it("add() adds a new record and it is returned by resolve", async () => {
    const provider = new MemoryProvider([
      makeRecord("my-key", 1, Status.Active),
    ]);
    provider.add(makeRecord("my-key", 2, Status.Active));
    const record = await provider.resolve("my-key");
    expect(record.version).toBe(2);
  });

  it("add() makes the new record available via resolveVersion", async () => {
    const provider = new MemoryProvider([]);
    provider.add(makeRecord("added-key", 5, Status.Active));
    const record = await provider.resolveVersion("added-key", 5);
    expect(record.version).toBe(5);
    expect(record.ref).toBe("added-key");
  });
});
