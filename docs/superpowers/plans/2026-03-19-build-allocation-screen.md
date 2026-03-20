# Build Allocation Screen Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/builds` form with a fixed-budget control console that uses draggable allocation bars on the left and a live 10-axis radar chart on the right while preserving the existing run-start flow.

**Architecture:** Keep the redesign isolated to `apps/web`. Introduce a small allocation state model and pure rebalance helpers first, then build the left console and right radar chart on top of that state, and finally wire submission back into the existing `createRun` client. Preserve current API contracts unless implementation proves a mismatch.

**Tech Stack:** Next.js App Router, React client components, Vitest, existing web shell CSS, existing `createRun` API client

---

## File Structure

- Modify: `apps/web/src/app/builds/page.tsx`
  Responsibility: replace the old page wrapper with the new build allocation screen entrypoint.
- Modify: `apps/web/src/components/build-profile-form.tsx`
  Responsibility: stop being a select-based form and become the client-side container for allocation state, summary, submit, and error handling.
- Create: `apps/web/src/components/allocation-bar.tsx`
  Responsibility: render a single draggable budget bar and convert pointer position into a target value.
- Create: `apps/web/src/components/build-radar-chart.tsx`
  Responsibility: render the live 10-axis radar chart using the current allocation values.
- Create: `apps/web/src/components/build-summary.tsx`
  Responsibility: derive and present a short textual interpretation such as `robustness-heavy, safety-weighted`.
- Create: `apps/web/src/lib/build-allocation.ts`
  Responsibility: hold pure helpers for default allocation, rebalance, rounding, visible/advanced grouping, and API payload mapping.
- Modify: `apps/web/src/lib/trial-types.ts`
  Responsibility: add any local types needed for numeric allocation state if the helpers require them.
- Modify: `apps/web/src/app/layout.tsx`
  Responsibility: tune shared page-level styles only as needed to support the control-console layout.
- Modify: `apps/web/src/components/build-profile-form.test.tsx`
  Responsibility: cover the new console layout, advanced section, and submit behavior.
- Create: `apps/web/src/lib/build-allocation.test.ts`
  Responsibility: cover pure budget rebalance rules and payload mapping.
- Modify: `apps/web/src/components/live-stage.test.tsx`
  Responsibility: no behavior change expected; only touch if the shared visual shell changes break assumptions.

## Chunk 1: Allocation State And Rebalance Helpers

### Task 1: Define the numeric allocation model

**Files:**
- Create: `apps/web/src/lib/build-allocation.ts`
- Create: `apps/web/src/lib/build-allocation.test.ts`
- Modify: `apps/web/src/lib/trial-types.ts`

- [ ] **Step 1: Write the failing test for default allocation totaling 100**

```ts
it("seeds a default allocation that always totals 100", () => {
  const allocation = createDefaultAllocation();
  expect(sumAllocation(allocation)).toBe(100);
  expect(allocation.robustness).toBeGreaterThan(allocation.costAwareness);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/lib/build-allocation.test.ts -t "seeds a default allocation"`
Expected: FAIL because `build-allocation.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal allocation types and default seed**

```ts
export type BuildAllocation = Record<AttributeName, number>;

export function createDefaultAllocation(): BuildAllocation {
  return {
    planning: 10,
    execution: 10,
    toolProficiency: 9,
    recovery: 9,
    efficiency: 7,
    correctness: 9,
    robustness: 14,
    safetyDiscipline: 14,
    costAwareness: 8,
    observability: 10
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/lib/build-allocation.test.ts -t "seeds a default allocation"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/build-allocation.ts apps/web/src/lib/build-allocation.test.ts apps/web/src/lib/trial-types.ts
git commit -m "feat: add build allocation model"
```

### Task 2: Add proportional rebalance and payload mapping

**Files:**
- Modify: `apps/web/src/lib/build-allocation.ts`
- Modify: `apps/web/src/lib/build-allocation.test.ts`

- [ ] **Step 1: Write the failing tests for rebalance behavior and API mapping**

```ts
it("rebalances other non-zero attributes proportionally when one attribute increases", () => {
  const allocation = createDefaultAllocation();
  const next = rebalanceAllocation(allocation, "planning", 40);
  expect(sumAllocation(next)).toBe(100);
  expect(next.planning).toBe(40);
  expect(next.robustness).toBeLessThan(allocation.robustness);
  expect(Object.values(next).every((value) => value >= 0)).toBe(true);
});

it("maps numeric allocation into the existing createRun build payload", () => {
  const payload = toDeclaredBuild({
    planning: 40,
    execution: 18,
    toolProficiency: 14,
    recovery: 10,
    efficiency: 4,
    correctness: 4,
    robustness: 4,
    safetyDiscipline: 4,
    costAwareness: 1,
    observability: 1
  });
  expect(payload.planning).toBe("high");
  expect(payload.execution).toBe("medium");
  expect(payload.costAwareness).toBe("low");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/lib/build-allocation.test.ts`
Expected: FAIL because rebalance and mapping helpers are not implemented.

- [ ] **Step 3: Implement the minimal pure helpers**

```ts
export function rebalanceAllocation(
  allocation: BuildAllocation,
  target: AttributeName,
  nextValue: number
): BuildAllocation {
  // clamp target, proportionally shrink other non-zero values, normalize rounding drift to 100
}

export function toDeclaredBuild(allocation: BuildAllocation): DeclaredBuild {
  // map numeric ranges to low / medium / high
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/lib/build-allocation.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/build-allocation.ts apps/web/src/lib/build-allocation.test.ts
git commit -m "feat: add proportional build rebalance logic"
```

## Chunk 2: Left Console UI

### Task 3: Replace the select wall with allocation bars

**Files:**
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Create: `apps/web/src/components/allocation-bar.tsx`
- Modify: `apps/web/src/components/build-profile-form.test.tsx`

- [ ] **Step 1: Write the failing test for the control console layout**

```tsx
it("renders six core allocation bars and keeps advanced attributes collapsed by default", () => {
  const markup = renderToStaticMarkup(<BuildProfileForm />);
  expect(markup).toContain("100 pts budget");
  expect(markup).toContain("Planning");
  expect(markup).toContain("Safety discipline");
  expect(markup).toContain("Advanced allocation");
  expect(markup).not.toContain("Cost awareness</span>");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx -t "renders six core allocation bars"`
Expected: FAIL because the component still renders select inputs.

- [ ] **Step 3: Implement the minimal console structure**

```tsx
<section className="allocation-console">
  <header>...</header>
  {coreAttributes.map((attribute) => (
    <AllocationBar key={attribute} ... />
  ))}
  <details>
    <summary>Advanced allocation</summary>
    ...
  </details>
</section>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx -t "renders six core allocation bars"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/build-profile-form.tsx apps/web/src/components/allocation-bar.tsx apps/web/src/components/build-profile-form.test.tsx
git commit -m "feat: add build allocation console layout"
```

### Task 4: Wire drag/click updates and submit mapping

**Files:**
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Modify: `apps/web/src/components/allocation-bar.tsx`
- Modify: `apps/web/src/components/build-profile-form.test.tsx`

- [ ] **Step 1: Write the failing test for submit behavior**

```tsx
it("submits the derived declared build through createRun", async () => {
  // mock createRun, simulate a rebalance action, submit form
  expect(createRun).toHaveBeenCalledWith(
    expect.objectContaining({
      build: expect.objectContaining({ planning: "high" })
    })
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx`
Expected: FAIL because state is still DOM-form driven and not based on numeric allocation mapping.

- [ ] **Step 3: Implement the minimal controlled-state submission**

```tsx
const [allocation, setAllocation] = useState(createDefaultAllocation());

function handleAllocationChange(attribute: AttributeName, value: number) {
  setAllocation((current) => rebalanceAllocation(current, attribute, value));
}

await createRun({
  agentVersion,
  build: toDeclaredBuild(allocation),
  ...
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/build-profile-form.tsx apps/web/src/components/allocation-bar.tsx apps/web/src/components/build-profile-form.test.tsx
git commit -m "feat: wire allocation console submission"
```

## Chunk 3: Radar Chart And Shell Polish

### Task 5: Render the live 10-axis chart and summary

**Files:**
- Create: `apps/web/src/components/build-radar-chart.tsx`
- Create: `apps/web/src/components/build-summary.tsx`
- Modify: `apps/web/src/components/build-profile-form.tsx`
- Modify: `apps/web/src/components/build-profile-form.test.tsx`

- [ ] **Step 1: Write the failing test for the chart-side readout**

```tsx
it("renders the live build shape and summary alongside the console", () => {
  const markup = renderToStaticMarkup(<BuildProfileForm />);
  expect(markup).toContain("Build shape");
  expect(markup).toContain("robustness");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx -t "renders the live build shape"`
Expected: FAIL because no radar chart exists.

- [ ] **Step 3: Implement the minimal radar chart and summary**

```tsx
<aside className="panel stack-md">
  <p className="eyebrow">Build shape</p>
  <BuildRadarChart allocation={allocation} />
  <BuildSummary allocation={allocation} />
</aside>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/components/build-profile-form.test.tsx -t "renders the live build shape"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/build-radar-chart.tsx apps/web/src/components/build-summary.tsx apps/web/src/components/build-profile-form.tsx apps/web/src/components/build-profile-form.test.tsx
git commit -m "feat: add live build radar chart"
```

### Task 6: Tune the shell styles for the control-console page

**Files:**
- Modify: `apps/web/src/app/layout.tsx`
- Modify: `apps/web/src/app/builds/page.tsx`

- [ ] **Step 1: Write the failing build verification step**

Run: `pnpm --filter @openclaw/web exec next build`
Expected: build succeeds but the page still lacks the control-console layout and responsive spacing needed by the spec.

- [ ] **Step 2: Implement the minimal page-shell polish**

```tsx
<main className="build-screen">
  <BuildProfileForm />
</main>
```

Add only the CSS variables and layout rules needed for:

- two-column console/chart layout
- compact control density
- advanced section spacing
- responsive collapse to one column on narrow screens

- [ ] **Step 3: Run the build verification again**

Run: `pnpm --filter @openclaw/web exec next build`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/layout.tsx apps/web/src/app/builds/page.tsx
git commit -m "feat: polish build allocation screen layout"
```

## Chunk 4: Final Verification

### Task 7: Run focused regression checks

**Files:**
- Test: `apps/web/src/lib/build-allocation.test.ts`
- Test: `apps/web/src/components/build-profile-form.test.tsx`
- Test: `apps/web/src/components/live-stage.test.tsx`

- [ ] **Step 1: Run focused web tests**

Run: `NODE_PATH=node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules node node_modules/.pnpm/vitest@3.2.4_@types+node@22.19.15_tsx@4.21.0/node_modules/vitest/vitest.mjs run apps/web/src/lib/build-allocation.test.ts apps/web/src/components/build-profile-form.test.tsx apps/web/src/components/live-stage.test.tsx`
Expected: PASS

- [ ] **Step 2: Run web typecheck**

Run: `node node_modules/.pnpm/typescript@5.9.3/node_modules/typescript/bin/tsc -p apps/web/tsconfig.json --noEmit`
Expected: PASS

- [ ] **Step 3: Run the end-to-end path**

Run: `node node_modules/.pnpm/playwright@1.58.2/node_modules/playwright/cli.js test tests/e2e/trial-arena.spec.ts --grep "user can launch a trial and open replay"`
Expected: PASS with the new `/builds` interaction still reaching arena and replay.

- [ ] **Step 4: Commit**

```bash
git add apps/web tests/e2e/trial-arena.spec.ts
git commit -m "feat: redesign build allocation screen"
```
