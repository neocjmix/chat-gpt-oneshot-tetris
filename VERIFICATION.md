# Verification record — 2026-10-01

## Current outcome

**GitHub Pages deployment succeeded.** Live address: https://neocjmix.github.io/chat-gpt-oneshot-tetris/

The user created the public repository and later enabled GitHub Pages in its settings. The implementation, deployment workflow, and recovery changes were authored directly through the connected GitHub API on `main`. No Codex, Work, computer-use session, local development server, local shell, Python execution, or separate browser execution environment was used. Tests and HTTP checks ran inside the repository's GitHub Actions workflow.

The initial deployment failed because first-time Pages creation was denied. After the user enabled Pages, retrying the original run exposed a second failure: duplicate artifacts named `github-pages`. The workflow was corrected to use a matching upload/deploy artifact name containing both `github.run_id` and `github.run_attempt`. A new push-triggered run then passed tests, deployed the site, and checked the published HTML and JavaScript. Historical failures are retained below rather than being reported as successful attempts.

## Latest successful run

- Workflow: [Check and deploy Pages, run 36858479066](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36858479066)
- Tested and deployed commit: `c74098f2e06f844875e3a65948900ae412f3b50f`
- Trigger: push to `main`, after the artifact-name correction
- [Rules and static checks, job 110356569573](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36858479066/job/110356569573): **success**
- [Publish site, job 110356612872](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36858479066/job/110356612872): **success**
- Pages action reported deployment success: 2026-10-01 11:56:29 UTC / 20:56:29 KST
- `Configure or initialize Pages`, `Deploy to GitHub Pages`, and `Check published HTTP responses`: **success**

Both job logs were fetched through the GitHub connector and read. Node.js v22.23.2 executed `node --check site/engine.js`, `node --check site/app.js`, and `node --test tests/engine.test.cjs` on GitHub's runner.

Actual test summary:

```text
# tests 38
# pass 38
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

Coverage includes all seven pieces, 7-bag ordering, rotations, left-wall and floor kicks, rejected collisions, soft and hard drop scoring, ghost landing positions, 1–4 line removal and compaction, level progression, combos, hold limits, gravity, lock delay and reset cap, pause/resume, top-out, restart, event draining, a 5,000-step deterministic input sequence, relative asset existence, and literal DOM-ID references. These tests execute the rules engine, not a browser or the browser event loop.

### Published HTTP checks

The successful deployment job used `curl --fail --location` to retrieve the live entry point, `engine.js`, and `app.js`. It found `<title>NIGHT SHIFT · Pocket Tetris</title>` in the returned HTML and used `cmp` to establish byte-for-byte equality between the published JavaScript files and the checked-out deployment revision. The entire check step passed. This is an observed GitHub-hosted HTTP check, not a locally executed browser test.

The log reports transfers of 6,108 bytes for HTML, 8,873 for `engine.js`, and 18,314 for `app.js`. It does not print numerical HTTP status codes, so no exact status code is asserted. CSS and favicon are included in the deployment artifact but were not separately fetched by this HTTP check. HTML content was checked for the title, not compared byte-for-byte.

An additional attempt to read the live address with the chat web-fetch tool returned that the address was not accessible through that tool, without an HTTP status code. That tool limitation is not interpreted as a site 404. The successful live-HTTP evidence above comes from the Actions job logs.

### Published artifact

`Upload static site` included exactly the five runtime assets in `site/`: `index.html`, `style.css`, `engine.js`, `app.js`, and `favicon.svg`.

- Artifact name: `github-pages-36858479066-1`
- Artifact ID: `11160406398`
- Size reported by GitHub: `13758` bytes (compressed artifact, not uncompressed application size)
- [Artifact associated with the successful run](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36858479066/artifacts/11160406398)
- The deploy action found exactly one artifact with the requested name and created the Pages deployment from it.
- Retention: one day; the artifact link is not a permanent distribution channel. Use the live Pages address instead.

Subsequent changes to README and this record are documentation only. They do not change the tested runtime files or trigger the deployment workflow.

## Historical deployment failures and recovery

### 1. Initial Pages enablement denied

- [Initial run 36856154118](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36856154118)
- Initial implementation/workflow commit: `c34e28c0b453e8e59a3f0eeba2c5295f066d8e4c`
- Initial run completion: 2026-10-01 11:34:10 UTC / 20:34:10 KST
- [Rules job 110348997724](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36856154118/job/110348997724): **success**, 38 tests passed on Node.js v22.23.3
- [Publish job 110349042327](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36856154118/job/110349042327): **failure**
- Initial artifact `11159122416`: uploaded successfully, 13,757 compressed bytes; this was not a published site.

`Configure or initialize Pages` used `actions/configure-pages@v5` with `enablement: true`. The log showed `Pages: write` for the workflow token, but first-time site creation was rejected:

```text
Get Pages site failed. Error: Not Found
Create Pages site failed. Error: Resource not accessible by integration
HttpError: Resource not accessible by integration
```

The deploy and live-HTTP steps were **skipped**, not passed. The linked account's repository metadata reported admin/push permissions, but that did not grant the separate Actions `GITHUB_TOKEN` permission to create the site. The connected GitHub action catalog inspected in that session did not expose a Pages-settings write operation.

The user subsequently changed **Settings → Pages → Build and deployment → Source** to GitHub Actions. A later successful configure step confirmed that the original enablement blocker was resolved.

### 2. Retrying the original run duplicated its artifact name

After the user's settings change, the assistant requested a retry of the failed job in run `36856154118` rather than starting a new workflow run. [Publish job 110354778760](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36856154118/job/110354778760) successfully configured Pages but failed at deployment on 2026-10-01 at approximately 11:51 UTC / 20:51 KST:

```text
Multiple artifacts named "github-pages" were unexpectedly found for this workflow run. Artifact count is 2.
```

The re-upload created artifact `11159761034` alongside the original run's artifact. Retrying was therefore not sufficient to complete deployment. This was a workflow/retry problem, not another Pages-settings failure.

Recovery commit `c74098f2e06f844875e3a65948900ae412f3b50f` set upload `name` and deploy `artifact_name` to the same `github-pages-${{ github.run_id }}-${{ github.run_attempt }}` expression. This gives each attempt a distinct name while keeping upload and deployment paired. The commit triggered the new successful run recorded above. The corrected workflow's first attempt was observed to pass; a second attempt of the corrected workflow has not separately been tested.

For future runs, push a relevant change or use **Actions → Check and deploy Pages → Run workflow → main**. Do not retry historical runs expecting them to use the corrected workflow: those runs reference their original commit.

Official references: [upload-pages-artifact inputs](https://github.com/actions/upload-pages-artifact/blob/v3/action.yml), [deploy-pages inputs](https://github.com/actions/deploy-pages/blob/v5/action.yml), [GitHub Pages publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Not directly verified

No browser was launched. The following remain unverified in a real browser: startup and menu interaction; touch, multitouch and long-press behavior; keyboard input; Canvas appearance and performance; sound; localStorage failure handling; focus and background transitions; portrait/landscape changes; Safari dynamic browser chrome and safe-area behavior; viewport clipping and unintended scrolling; and direct `file://` startup. Live HTML and JavaScript delivery are now checked by CI, but this does not establish that interactive gameplay works in a browser.

The mobile UI uses explicit touch controls, pointer capture and cancellation, fixed-page overflow handling, `100dvh`, safe-area padding, a stage-measured board size, and a short-landscape layout. Those are implementation choices visible in the source, not evidence of device testing. The dialog's own help area may intentionally scroll when expanded; the game page is designed not to scroll.

## Other observed errors and warnings

The first `site/app.js` create-file request was blocked by the tool with a message that it could not determine the request's security state. A subsequent file read returned 404, confirming that attempt had not created the file. One retry of the same create-file request succeeded at commit `1f058948dc44f4334b8ba6462eed1d086426d7b3`; CI then checked that actual file. No alternate environment or hidden write path was used.

The official workflow helper actions emitted Node.js 20 deprecation / forced-Node.js-24 warnings, plus `punycode` / `url.parse()` deprecation warnings. These warnings remain in the successful run; they did not block tests or deployment.

## Product boundaries

This is an independent falling-block puzzle implementation, not a certified or official Tetris product. It has classic line scoring with a combo bonus, but no T-spin/back-to-back-specific score recognition. Best score and sound preference are local only. A running game is not persisted across reloads. Full nonvisual Canvas gameplay is not implemented.
