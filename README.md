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

## License

MIT
