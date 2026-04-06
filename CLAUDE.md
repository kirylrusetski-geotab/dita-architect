# DITA Architect — Project Instructions

## Version Bump Checklist

When bumping the version in `constants/version.ts` and writing release notes:

1. Update the version string and release notes in `constants/version.ts`
2. Move shipped backlog items to the Completed section in `future-state/BACKLOG.md`
3. **Delete resolved bug reports** — scan `bugreports/` and remove any files for bugs that shipped in this release
4. **Update feature request statuses** — scan `future-state/feature-requests.md` and update the `**Status:**` field to `Shipped (vX.Y.Z, YYYY-MM-DD)` for any FRs that shipped in this release
