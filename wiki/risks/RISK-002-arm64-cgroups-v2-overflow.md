# RISK-002: ARM64 cgroups v2 job-status overflow (HC-630)

**Severity:** High  
**Likelihood:** Medium  
**Affected components:** hysds (job_worker, log_utils job-status indexing), OpenSearch job-status index  
**Owner:** hysds-core team  
**Date recorded:** 2026-06-08

## Description

On ARM64/Graviton workers, cgroups v2 memory statistics can exceed the range of a 64-bit signed long integer, causing integer overflow when hysds attempts to write job-status updates to OpenSearch.

The issue manifests in `log_utils.py` when memory stats are marshalled as part of the job-status payload: code that reads cgroups v2 memory values (e.g., `memory.current`, `memory.max`) and casts them to a long may overflow on systems with large physical memory or unusual cgroup configurations.

This is a deployment-specific risk: it does not affect x86_64 clusters unless they also have high-memory ARM64 nodes, or if cgroups v2 is explicitly enabled on x86_64. Most HPC clusters run cgroups v1 or have not hit the threshold.

## Mitigation

Fix was applied in commit **HC-630** (hysds repo). The fix likely:
- Converts memory stats to a wider integer type (e.g., uint64, decimal, or string).
- Or skips overflow-prone stats entirely if they cannot be safely serialized.

**Action:** Ensure HC-630 is cherry-picked into all production branches and deployments targeting ARM64/Graviton. When provisioning new ARM64 worker fleets, verify that cgroups v2 is either disabled or that memory stats are captured safely. Consider adding a pre-flight check in the worker startup that validates cgroup memory is readable and does not overflow.

## Status

Mitigated (HC-630 applied); Risk of reoccurrence on new ARM64 deployments if fix is not applied.
