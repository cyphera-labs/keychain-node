/**
 * Worker script for synchronous bridge resolution.
 * Reads JSON from stdin, resolves key, writes hex to stdout.
 */

import { VaultProvider } from "./vault";
import { AwsKmsProvider } from "./aws-kms";
import { GcpKmsProvider } from "./gcp-kms";
import { AzureKvProvider } from "./azure-kv";
import type { KeyProvider } from "./provider";

async function main() {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    const { source, config } = JSON.parse(Buffer.concat(chunks).toString());

    const ref = config.ref || config.path || config.arn || config.key || "default";
    const provider = createProvider(source, config);
    const record = await provider.resolve(ref);
    process.stdout.write(record.material.toString("hex"));
}

function createProvider(source: string, config: Record<string, any>): KeyProvider {
    switch (source) {
        case "vault":
            return new VaultProvider({
                url: config.addr || process.env.VAULT_ADDR || "http://127.0.0.1:8200",
                token: config.token || process.env.VAULT_TOKEN || "",
                mount: config.mount || "secret",
            });
        case "aws-kms":
            return new AwsKmsProvider({
                keyId: config.arn || "",
                region: config.region || process.env.AWS_REGION || "us-east-1",
                endpoint: config.endpoint,
            });
        case "gcp-kms":
            return new GcpKmsProvider({
                keyName: config.resource || "",
            });
        case "azure-kv":
            return new AzureKvProvider({
                vaultUrl: `https://${config.vault}.vault.azure.net`,
                keyName: config.key || "",
            });
        default:
            throw new Error(`Unknown source: ${source}`);
    }
}

main().catch((e) => {
    process.stderr.write(e.message);
    process.exit(1);
});
