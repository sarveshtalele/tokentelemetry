## What does this PR do?

<!-- One or two sentences. -->

## Why?

<!-- The motivation -- what was broken, missing, or worth improving. -->

## How was this tested?

- [ ] `pytest tests/test_backend_api.py tests/test_reconcile.py` passes
- [ ] `cd frontend && npm run build` passes (type-check + build)
- [ ] Manually verified in the running app (describe what you clicked through, if UI-facing)

## Checklist

- [ ] If this touches schema or collector/reconcile logic, it's in `telemetry/` (the single
      canonical implementation `backend/` imports directly) -- not a new duplicate copy.
- [ ] No unrelated changes bundled in.
