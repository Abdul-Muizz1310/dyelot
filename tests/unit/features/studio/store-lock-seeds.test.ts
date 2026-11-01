import { describePairLock, describePrimaryLock, SEED_N } from "./lock-support";

// C-STORE-34 of docs/specs/02-studio.md (R2-17) over seed-1 to seed-20, at AA and AAA: locking
// secondary or accent keeps every role; locking primary keeps the primary role within ΔEOK 0.0016.
describePairLock("AA", SEED_N);
describePairLock("AAA", SEED_N);
describePrimaryLock("AA", SEED_N, { primaryDE: 0.0016, identical: 15 });
describePrimaryLock("AAA", SEED_N, { primaryDE: 0.0016, identical: 13 });
