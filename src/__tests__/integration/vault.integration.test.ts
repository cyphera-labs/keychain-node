import { VaultProvider } from "../../vault";
import { Status } from "../../provider";

const VAULT_ADDR = process.env.VAULT_ADDR ?? "http://localhost:8200";
const VAULT_TOKEN = process.env.VAULT_TOKEN ?? "root";
const MATERIAL_HEX = "aabbccdd".repeat(8);

async function writeSecret(path: string, data: object) {
  const resp = await fetch(`${VAULT_ADDR}/v1/secret/data/${path}`, {
    method: "POST",
    headers: { "X-Vault-Token": VAULT_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!resp.ok) throw new Error(`Vault write failed: ${resp.status}`);
}

describe("VaultProvider integration", () => {
  const provider = new VaultProvider({ url: VAULT_ADDR, token: VAULT_TOKEN });

  beforeAll(async () => {
    // Enable KV v2 secret engine
    await fetch(`${VAULT_ADDR}/v1/sys/mounts/secret`, {
      method: "POST",
      headers: { "X-Vault-Token": VAULT_TOKEN, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "kv", options: { version: "2" } }),
    });
  });

  it("resolves an active key", async () => {
    await writeSecret("integ-primary", {
      version: 1, status: "active", algorithm: "adf1", material: MATERIAL_HEX,
    });
    const rec = await provider.resolve("integ-primary");
    expect(rec.status).toBe(Status.Active);
    expect(rec.material).toEqual(Buffer.from(MATERIAL_HEX, "hex"));
  });
});
