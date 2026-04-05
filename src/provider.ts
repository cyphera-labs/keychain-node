export enum Status {
  Active = "active",
  Deprecated = "deprecated",
  Disabled = "disabled",
}

export interface KeyRecord {
  ref: string;
  version: number;
  status: Status;
  algorithm: string;
  material: Buffer;
  tweak: Buffer | null;
  metadata: Record<string, string>;
  createdAt: Date | null;
}

export interface KeyProvider {
  resolve(ref: string): Promise<KeyRecord>;
  resolveVersion(ref: string, version: number): Promise<KeyRecord>;
}

export class KeyNotFoundError extends Error {
  constructor(ref: string, version?: number) {
    if (version !== undefined) {
      super(`key not found: ref=${ref} version=${version}`);
    } else {
      super(`key not found: ref=${ref}`);
    }
    this.name = "KeyNotFoundError";
    Object.setPrototypeOf(this, KeyNotFoundError.prototype);
  }
}

export class KeyDisabledError extends Error {
  constructor(ref: string, version: number) {
    super(`key is disabled: ref=${ref} version=${version}`);
    this.name = "KeyDisabledError";
    Object.setPrototypeOf(this, KeyDisabledError.prototype);
  }
}

export class NoActiveKeyError extends Error {
  constructor(ref: string) {
    super(`no active key found: ref=${ref}`);
    this.name = "NoActiveKeyError";
    Object.setPrototypeOf(this, NoActiveKeyError.prototype);
  }
}
