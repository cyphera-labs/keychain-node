/**
 * Bridge resolver for Cyphera SDK integration.
 * Called by the SDK when a key config has "source" set to a cloud provider.
 *
 * Since the SDK constructor is synchronous but keychain providers are async,
 * this bridge spawns a child process to do the async resolution at startup.
 * Keys are fetched once at startup — never per-operation.
 */

import { execFileSync } from "child_process";
import * as path from "path";

/**
 * Resolve a key from a cloud provider based on the cyphera.json key config.
 * Returns raw key bytes as a Buffer (synchronous).
 */
export function resolve(source: string, config: Record<string, unknown>): Buffer {
    const script = path.join(__dirname, "bridge-worker.js");
    const input = JSON.stringify({ source, config });

    try {
        const hex = execFileSync(process.execPath, [script], {
            input,
            encoding: "utf8",
            timeout: 30000,
            env: process.env,
        }).trim();

        if (!hex || hex.length === 0) {
            throw new Error("empty response from keychain resolver");
        }
        return Buffer.from(hex, "hex");
    } catch (e: any) {
        if (e.stderr) {
            throw new Error(`Keychain resolution failed for source '${source}': ${e.stderr.toString().trim()}`);
        }
        throw new Error(`Keychain resolution failed for source '${source}': ${e.message}`);
    }
}
