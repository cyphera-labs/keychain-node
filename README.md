# Cyphera Keychain — Node.js

Key provider abstraction for the [Cyphera](https://cyphera.dev) Node.js SDK.

## Installation

```sh
npm install @cyphera/keychain
```

## Usage

### Memory provider (testing / development)

```typescript
import { MemoryProvider, Status } from '@cyphera/keychain';

const provider = new MemoryProvider([
  {
    ref: 'customer-primary',
    version: 1,
    status: Status.Active,
    material: Buffer.from('0123456789abcdef0123456789abcdef', 'hex'),
    tweak: Buffer.from('customer-ssn'),
    algorithm: '',
    metadata: {},
    createdAt: null,
  },
]);

const record = await provider.resolve('customer-primary');
```

### Environment variable provider

```typescript
import { EnvProvider } from '@cyphera/keychain';

// Reads CYPHERA_CUSTOMER_PRIMARY_KEY (hex or base64)
const provider = new EnvProvider('CYPHERA');
const record = await provider.resolve('customer-primary');
```

### File provider

```typescript
import { FileProvider } from '@cyphera/keychain';

const provider = new FileProvider('/etc/cyphera/keys.json');
const record = await provider.resolve('customer-primary');
```

Key file format:

```json
{
  "keys": [
    {
      "ref": "customer-primary",
      "version": 1,
      "status": "active",
      "algorithm": "adf1",
      "material": "<hex or base64>",
      "tweak": "<hex or base64>"
    }
  ]
}
```

## Providers

| Provider | Description | Use case |
|---|---|---|
| `MemoryProvider` | In-memory key store | Testing, development |
| `EnvProvider` | Keys from environment variables | 12-factor / container deployments |
| `FileProvider` | Keys from a local JSON file | Secrets manager file injection |

## Cloud KMS Providers

Cyphera supports four cloud KMS and secrets backends. Install the relevant SDK alongside `@cyphera/keychain` and import the provider you need.

### AWS KMS

```typescript
import { AwsKmsProvider } from '@cyphera/keychain';

// npm install @aws-sdk/client-kms
const provider = new AwsKmsProvider({
  keyId: 'arn:aws:kms:us-east-1:123456789012:key/your-key-id',
  region: 'us-east-1',
});

const record = await provider.resolve('customer-primary');
```

The provider calls `GenerateDataKey` (AES-256) on first resolution and caches the plaintext in memory for the lifetime of the instance.

### GCP Cloud KMS

```typescript
import { GcpKmsProvider } from '@cyphera/keychain';

// npm install @google-cloud/kms
const provider = new GcpKmsProvider({
  keyName:
    'projects/my-project/locations/global/keyRings/my-ring/cryptoKeys/my-key',
});

const record = await provider.resolve('customer-primary');
```

A random 32-byte data key is generated locally and wrapped via `Encrypt` on first resolution. The plaintext is cached in memory.

### Azure Key Vault

```typescript
import { AzureKvProvider } from '@cyphera/keychain';

// npm install @azure/keyvault-keys @azure/identity
const provider = new AzureKvProvider({
  vaultUrl: 'https://my-vault.vault.azure.net',
  keyName: 'my-rsa-key',
});

const record = await provider.resolve('customer-primary');
```

Uses `DefaultAzureCredential` for authentication. A random 32-byte data key is wrapped with RSA-OAEP on first resolution and the plaintext is cached in memory.

### HashiCorp Vault

```typescript
import { VaultProvider } from '@cyphera/keychain';

const provider = new VaultProvider({
  url: 'http://vault.internal:8200',
  token: process.env.VAULT_TOKEN!,
  mount: 'secret',   // KV v2 mount, defaults to "secret"
});

const record = await provider.resolve('customer-primary');
```

Reads keys from Vault KV v2. The secret at `<mount>/data/<ref>` should contain fields: `version`, `status` (`active` | `deprecated` | `disabled`), `algorithm`, `material` (hex or base64), and optionally `tweak`. Multiple key versions can be stored under a `versions` array.

| Provider | Description | Use case |
|---|---|---|
| `AwsKmsProvider` | AWS KMS data-key generation | AWS-native deployments |
| `GcpKmsProvider` | GCP Cloud KMS key wrapping | GCP-native deployments |
| `AzureKvProvider` | Azure Key Vault RSA-OAEP wrapping | Azure-native deployments |
| `VaultProvider` | HashiCorp Vault KV v2 | Multi-cloud / on-premises |

## License

MIT
