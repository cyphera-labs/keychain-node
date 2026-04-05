import {
  KeyProvider,
  KeyRecord,
  Status,
  KeyNotFoundError,
  KeyDisabledError,
  NoActiveKeyError,
} from "./provider";

export class MemoryProvider implements KeyProvider {
  private records: KeyRecord[];

  constructor(records: KeyRecord[] = []) {
    this.records = [...records].sort((a, b) => b.version - a.version);
  }

  add(record: KeyRecord): void {
    this.records.push(record);
    this.records.sort((a, b) => b.version - a.version);
  }

  async resolve(ref: string): Promise<KeyRecord> {
    const matching = this.records.filter(
      (r) => r.ref === ref && r.status === Status.Active
    );
    if (matching.length === 0) {
      const anyForRef = this.records.some((r) => r.ref === ref);
      if (!anyForRef) {
        throw new KeyNotFoundError(ref);
      }
      throw new NoActiveKeyError(ref);
    }
    // records are already sorted descending by version; return highest active
    return matching[0];
  }

  async resolveVersion(ref: string, version: number): Promise<KeyRecord> {
    const record = this.records.find(
      (r) => r.ref === ref && r.version === version
    );
    if (!record) {
      throw new KeyNotFoundError(ref, version);
    }
    if (record.status === Status.Disabled) {
      throw new KeyDisabledError(ref, version);
    }
    return record;
  }
}
