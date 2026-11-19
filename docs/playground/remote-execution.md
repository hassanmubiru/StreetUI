# StreetUI Playground — Remote Execution (Design)

This is a design note only. No remote platform is built in M9. Third-party
browser execution platforms are not a hidden required dependency.

## Problem

Some AI environments cannot launch local npm processes or expose localhost
servers. A first-party, isolated execution service could host untrusted projects.

## Proposed shape

- Project upload → temporary isolated environment per session.
- Independent StreetUI CLI: dependency install, dev/build/preview commands.
- Preview URL + application diagnostics returned to the client.
- Time/resource limits, automatic cleanup, secret isolation.

## Requirements / responsibilities

- Isolated per-project runtimes (no cross-project access, no privileged host
  access).
- Network egress limits; dependency install from the public registry only.
- Time/memory/CPU limits; queue/retry; explicit budget.
- Cleanup on idle/timeout; ephemeral storage.
- Diagnostics sanitized (no host secrets).

## Costs / threats / operations

- Infrastructure: compute + egress; per-session lifecycle.
- Threats: malicious code, dependency supply-chain, resource exhaustion, secret
  leakage — mitigated by isolation, limits, and sanitization.
- Operations: capacity, quotas, observability, incident response.

## Decision gate

Build this only after the local Playground is proven and the funding/ops model
is approved. It is out of scope for M9.
