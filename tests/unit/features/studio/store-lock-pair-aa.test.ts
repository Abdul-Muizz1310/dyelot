import { describePairLock, SEED_S } from "./lock-support";

// C-STORE-34 of docs/specs/02-studio.md (R2-17): locking secondary or accent over s0 to s39 at AA.
describePairLock("AA", SEED_S);
