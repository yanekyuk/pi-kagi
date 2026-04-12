# Review: Step 4 Plan

**Verdict:** REVISE

## Feedback

The plan for Step 4 is mostly sound but contains a critical tooling mismatch that violates the project's tech stack guidelines.

1. **Test Runner/Package Manager:** The plan lists `npm --prefix .pi/extensions/pi-kagi test` as the command to run the test suite. The project guidelines explicitly require using `bun` as the package manager and test runner. You must use `bun test` (e.g., by running `cd .pi/extensions/pi-kagi && bun test` or `bun test --cwd .pi/extensions/pi-kagi`). Do not use `npm`.
2. **Test Coverage Details:** While the plan mentions testing "truncation behavior", ensure your tests specifically validate the 50KB / 2000 lines limit for tool output as outlined in the Review Criteria.
3. **Smoke Checks:** When logging your smoke checks in `STATUS.md`, be sure to note that the references/tokens are preserved correctly in the output, as mandated by the completion criteria.

Please update the command in your plan/STATUS.md to use `bun` and proceed with implementation!
