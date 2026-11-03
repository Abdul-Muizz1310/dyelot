import { describePrimaryLock, SEED_S } from "./lock-support";

// C-STORE-34 and C-STORE-41 of docs/specs/02-studio.md (R2-17): locking primary over s0 to s39 at
// AA, then three regenerations of each seed (newSeed gives `${seed}-r1` to `${seed}-r3`).
describePrimaryLock("AA", SEED_S, { primaryDE: 0.0074, identical: 27, kept: 99 }, 3);
