# Build Allocation Screen Design

## Summary

Redesign the `/builds` entry screen so it stops feeling like a placeholder form and instead behaves like a controllable build console. The screen should let the user allocate a fixed 100-point budget across agent attributes using draggable horizontal bars on the left, while a live multidimensional chart on the right visualizes the resulting build shape.

The interaction model is:

- fixed total budget: `100`
- drag one attribute higher and automatically compress the others proportionally
- show `6` core attributes by default
- keep the remaining `4` attributes inside an `Advanced allocation` section
- always render all `10` attributes in the radar chart

The chosen visual direction is the denser `Control Console` variant, not the more polished showcase variant.

## Goals

- Replace the current select-heavy build form with a tactile allocation interface.
- Make the first screen feel like an actual calibration tool rather than a demo scaffold.
- Give the user immediate feedback about the overall build shape while allocating points.
- Preserve a direct path into the existing `Start trial` flow.

## Non-Goals

- Redesigning the arena run screen or replay screen in this pass.
- Changing the domain attribute model or the 100-point budget rule after confirmation.
- Adding animation-heavy polish before the allocation mechanics feel correct.

## Layout

The `/builds` screen becomes a two-column control surface.

### Left Column: Allocation Console

The left side contains:

- build name / agent version input
- visible budget summary (`remaining 0 / 100`, `auto-balance on`)
- six default draggable bars
- an `Advanced allocation` collapsible section with the remaining four attributes
- a short textual build summary
- the primary `Start trial` action

The visible default six attributes should be the most decision-shaping ones:

- Planning
- Execution
- Tool proficiency
- Recovery
- Robustness
- Safety discipline

The advanced section should contain:

- Efficiency
- Correctness
- Cost awareness
- Observability

### Right Column: Live Build Shape

The right side contains:

- a radar chart rendering all ten dimensions
- faint concentric guide rings
- labeled axes
- the current polygon fill representing the active allocation
- a brief interpretation line such as `robustness-heavy, safety-weighted`

The chart should update immediately while the user drags bars.

## Interaction Model

Each horizontal bar represents a numeric slice of the total point budget.

### Budget Rules

- total budget is fixed at `100`
- values are continuous or near-continuous during drag, but may be rounded for display
- dragging one bar upward automatically reduces the rest proportionally
- bars already at zero should not go negative
- if the user drags one attribute downward, freed points should be redistributed proportionally across the non-zero remaining attributes only when needed by a later upward drag
- the UI should never show the budget going above or below `100`

### Dragging Behavior

Bars should feel like direct manipulation, not like disguised select boxes.

Expected behavior:

- click or drag anywhere on a bar track to set the target value
- value indicator updates immediately
- the remaining budget badge updates in the same frame
- the radar chart updates in the same frame
- other affected bars shift enough to keep the total valid

If proportional redistribution would produce unstable edge cases, clamp visually and prefer predictability over mathematical purity.

## Visual Direction

The page should feel like an instrument console:

- warm neutral background
- compact but readable density
- horizontal bars with strong color identities
- restrained serif-heavy typography already started in the current web shell
- chart treated like a tactical readout, not decorative hero art

The build screen should look intentional and utilitarian. It should suggest calibration, not onboarding.

## Component Design

Recommended component split:

- `BuildAllocationScreen`
- `AllocationConsole`
- `AllocationBar`
- `AdvancedAllocationSection`
- `BuildRadarChart`
- `BuildSummary`

Supporting state/helpers:

- normalized allocation state for all 10 attributes
- proportional rebalance helper
- drag-to-value conversion helper
- derived summary string helper

## Data Flow

Initial state should seed the 100-point budget across all attributes with a sane default distribution rather than a blank zeroed screen. This avoids rendering an empty radar chart and gives the user something meaningful to tune.

Suggested default:

- modest baseline across all attributes
- slight bias toward robustness and safety so the initial polygon is visually legible

On submit:

1. convert numeric allocations into the build payload expected by the current run creation API
2. map numeric values to the existing declared build shape format
3. keep the current run creation and redirect flow intact unless implementation reveals an API mismatch

## Error Handling

- if drag logic fails budget constraints, reject the update and keep the previous stable state
- if run creation fails, keep the current screen state and surface the error inline near the action
- advanced section open/closed state should not discard allocations

## Testing

Add tests for:

- proportional rebalance preserves total budget at `100`
- dragging one bar upward reduces other active bars without producing negatives
- radar chart receives all ten values
- advanced section preserves hidden attribute values
- submit still triggers run creation with the derived build payload

## Recommendation

Implement this redesign as a focused `/builds` rewrite only. Do not mix in arena-page polish or replay-page redesign while building the allocation mechanics. The risk is not styling complexity; it is getting the budget redistribution and live shape feedback to feel trustworthy.
