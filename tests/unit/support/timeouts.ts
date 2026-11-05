// Per-test timeouts for the heaviest tests, one constant per tier. Each is sized for
// gate:full's coverage run on CI hardware, where instrumentation makes these tests
// 3 to 6 times slower than their solo times and CI has fewer cores.

/** The ten measure-grid tests (the scan project). */
export const GRID_TEST_TIMEOUT = 1_800_000;

/** The 1000-run DTCG property, C-DTCG-14. */
export const DTCG_PROPERTY_TIMEOUT = 1_800_000;

/** The prompt property, C-PRM-02. */
export const PROMPT_PROPERTY_TIMEOUT = 600_000;

/** The all-time-zones zip determinism test, C-ZIP-03. */
export const ZIP_ZONES_TIMEOUT = 600_000;

/** The import fuzz tests, C-IMP-03 (CSS and DESIGN.md halves). */
export const IMPORT_FUZZ_TIMEOUT = 300_000;
