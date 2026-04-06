import { KMSClient, CreateKeyCommand } from "@aws-sdk/client-kms";
import { AwsKmsProvider } from "../../aws-kms";
import { Status } from "../../provider";

const ENDPOINT = process.env.AWS_ENDPOINT_URL ?? "http://localhost:4566";
const REGION = process.env.AWS_DEFAULT_REGION ?? "us-east-1";

describe("AwsKmsProvider integration", () => {
  let keyId: string;
  let provider: AwsKmsProvider;

  beforeAll(async () => {
    const admin = new KMSClient({
      region: REGION,
      endpoint: ENDPOINT,
      credentials: { accessKeyId: "test", secretAccessKey: "test" },
    });
    const resp = await admin.send(new CreateKeyCommand({ Description: "Cyphera integration test" }));
    keyId = resp.KeyMetadata!.KeyId!;
    provider = new AwsKmsProvider({ keyId, region: REGION, endpoint: ENDPOINT });
  });

  it("resolves an active key", async () => {
    const rec = await provider.resolve("integ-primary");
    expect(rec.status).toBe(Status.Active);
    expect(rec.material).toHaveLength(32);
  });

  it("caches the key", async () => {
    const r1 = await provider.resolve("integ-cached");
    const r2 = await provider.resolve("integ-cached");
    expect(r1.material).toEqual(r2.material);
  });
});
