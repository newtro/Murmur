# Deployment

How Murmur ships to users.

## Overview

Two distribution channels:

1. **GitHub Releases** (automated via Actions) — Windows MSIX, Windows NSIS .exe, macOS DMG, Linux .deb. Anyone with the release URL can download.
2. **Microsoft Store** (manual) — Windows users install through the Store app. Murmur is listed at [apps.microsoft.com](https://apps.microsoft.com/) under publisher `JohnnyCode.ai`. Submission goes through Partner Center.

GitHub Releases happens on every push to `main` with code changes. Microsoft Store submission is a separate manual step after the GitHub Release is published.

## Versioning

The release workflow auto-increments the **patch** version based on the highest existing `v*` git tag. So if the last tag is `v1.0.5`, the next push produces `v1.0.6`.

For a feature-bump (minor) or breaking-bump (major), manually tag before pushing:

```bash
git tag v1.1.0
git push --tags
git push origin main
```

The workflow's version-calc step uses `git tag -l 'v*' | sort -V | tail -1` to find the latest, then increments patch. To pin a version, ensure a higher tag already exists.

## GitHub Release flow (automatic)

Trigger: push to `main` that touches files NOT in [release.yml's `paths-ignore`](.github/workflows/release.yml) (so doc-only changes don't trigger builds).

What the workflow does:

1. **Version calc** (Ubuntu) — figure out next version + tag.
2. **Build matrix** (Windows + macOS + Linux runners):
   - Set `package.json` version
   - On Windows: stamp the version into `resources/AppxManifest.xml`
   - `npm ci`
   - `npm run make -- --arch=x64`
   - Upload artifacts (everything under `out/make/`)
3. **Release** (Ubuntu):
   - Download all artifacts
   - Create a GitHub release with tag `vX.Y.Z`
   - Attach all build artifacts
   - Body sourced from the top section of [CHANGELOG.md](../CHANGELOG.md) (the workflow extracts it via the awk step)

When CHANGELOG.md has a new `## vX.Y.Z` heading that matches the tag, that section's content becomes the release body. If no match, GitHub auto-generates notes from commit messages between the previous tag and HEAD.

**To write release notes for the next release:** add a `## vX.Y.Z` heading at the top of `CHANGELOG.md` (above older entries), with sections like `### Added`, `### Changed`, `### Fixed`, `### Known limitations`, `### Migration notes`. The workflow extracts everything from that heading down to the next `## ` heading.

## Microsoft Store submission (manual)

After the GitHub Release is published and you've grabbed the new `.msix` file:

1. **Sign in to Partner Center** at [partner.microsoft.com](https://partner.microsoft.com/dashboard/home). Use the JohnnyCode.ai publisher account.
2. **Apps and games → Murmur → Packages.** Click "Submit update" or "Create submission."
3. **Upload the `.msix`** built by the GitHub Actions run. Find it in the release at github.com/newtro/Murmur/releases/tag/vX.Y.Z, file name pattern `Murmur-X.Y.Z-x64.msix` (or similar — check the Forge MSIX maker output).
4. **Submission details:**
   - Bump the **package version** in the Store submission to match `vX.Y.Z.0` (Store expects 4-part versions; our manifest already uses `X.Y.Z.0`).
   - **Release notes**: copy the relevant section from `CHANGELOG.md`. Store front-end uses these as the "What's new" text users see.
   - **Pricing & availability**: should already be configured; leave as-is unless changing markets.
   - **Properties / age rating**: unchanged.
   - **Store listings**: only update if screenshots / description copy needs changes.
5. **Submit** for certification. Microsoft typically takes 24–72 hours to review and publish.
6. **Check certification status** in Partner Center → Murmur → Submissions. Once published, the Store shows the new version within an hour.

### What requires re-certification

Most code-only updates pass quickly. Re-certification can be slower (or rejected) when:

- **New capabilities in `AppxManifest.xml`** (e.g., the `microphone` capability added in v1.0.6). The Store reviews capability changes and may ask why they're needed. Be ready to justify in the submission notes — "live voice dictation requires microphone access" is sufficient.
- **`runFullTrust`** is in our manifest already; this requires the [restricted capabilities](https://learn.microsoft.com/en-us/windows/uwp/packaging/app-capability-declarations#restricted-capabilities) form on Partner Center if not already filed.
- **Privacy policy / EULA changes** trigger an extra review step.

## Build-and-test locally before pushing

Don't push directly to main without local validation:

```bash
npm ci                          # clean install
npm run typecheck               # TypeScript
npm test                        # vitest unit tests (29 tests as of v1.0.6)
npm run lint                    # ESLint (warnings OK, errors fail the gate)
npm start                       # smoke test the app
```

For a full MSIX build locally (catches manifest issues before CI does):

```bash
npm run make -- --arch=x64
```

Output lands in `out/make/`. The `.msix` is the file to sideload-test before pushing for the Store path. Right-click → "Install" works on dev machines with sideloading enabled.

## Rollback

If a release is bad:

1. **GitHub side**: delete the release at github.com/newtro/Murmur/releases (keeps the tag, removes the binaries from download). Optionally delete the tag.
2. **Store side**: in Partner Center, "Roll back to previous version" — or submit a hotfix release with a higher version. Microsoft does not allow re-publishing an existing version number.
3. **Already-installed clients**: NSIS users won't auto-update; they'd need a manual reinstall or auto-update has to do its thing (we don't ship auto-update yet, so reinstall is the answer). MSIX users get the next Store update on Microsoft's schedule.

## Secrets the workflow needs

- `GITHUB_TOKEN` — auto-injected by Actions, used for creating releases and uploading artifacts. No setup required.
- No code-signing certs are currently wired into the workflow. Windows builds are unsigned (the MSIX is signed by Microsoft when submitted to the Store; the NSIS .exe is unsigned and will show SmartScreen warnings on first run). Adding a signing cert is a future improvement.

## Troubleshooting

**The release workflow didn't trigger after my push.**
Check the file paths. Anything matching `**/*.md`, `.gitignore`, `.gitattributes`, `LICENSE`, or `.github/**` (except `release.yml` itself) is skipped. If your push is docs-only, that's working as intended.

**Windows build fails on `Preparing native dependencies`.**
Native modules (`uiohook-napi`, `@nut-tree-fork/libnut-win32`, etc.) need `electron-rebuild` to succeed. The CI runners install Python and Visual Studio Build Tools by default; if a dep changes its `binding.gyp` to require something exotic (the way `robotjs` v0.7.1 needed ClangCL), the runner build will fail. Locally reproduce with the same Node version (20.x) and check the rebuild log.

**MSIX install on Windows fails with a signature error.**
The package is unsigned for development. On Windows 11, enable Developer Mode (Settings → Privacy & security → For developers → Developer Mode) before sideloading. For Store distribution this doesn't matter — Microsoft re-signs the package.

**`AppxManifest.xml` version not updating on Windows builds.**
The workflow's `Update MSIX manifest version` step does a regex replace. If the regex hasn't matched (e.g. someone reformatted the XML), the build still produces a `.msix` but with the old version, and the Store will reject it for "version not incremented." Check the workflow logs for the `Set MSIX version to ...` line.
