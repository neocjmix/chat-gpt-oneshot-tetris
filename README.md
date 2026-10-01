# NIGHT SHIFT — Pocket Tetris

모바일 터치와 데스크톱 키보드로 플레이하는 작은 테트리스 게임입니다. HTML, CSS, JavaScript와 Canvas 2D만 사용하며 런타임 의존성, 번들러, 계정, 백엔드가 없습니다.

**플레이 주소:** https://neocjmix.github.io/chat-gpt-oneshot-tetris/

**2026-10-01 확인 상태:** GitHub Pages 배포 성공. GitHub Actions 문법 검사 및 **38개 테스트 통과**. 배포 후 HTML 응답과 `engine.js`·`app.js`의 저장소 원본 대비 바이트 일치 검사도 통과했습니다. 실제 브라우저 플레이와 모바일 레이아웃은 아직 직접 검증하지 않았습니다. [성공한 실행 기록](https://github.com/neocjmix/chat-gpt-oneshot-tetris/actions/runs/36858479066)과 [검증 범위 및 실패·복구 이력](VERIFICATION.md)을 확인하세요.

## 플레이

모바일용 하단 버튼에 모든 조작을 연결했습니다. 이동과 내리기 버튼은 길게 누르면 반복하도록 구현했습니다. 두 손가락 입력을 독립적으로 관리하고 하드 드롭은 별도 버튼으로 구분합니다. 실제 기기에서의 조작감과 레이아웃은 아직 검증하지 않았습니다.

| 동작 | 키보드 |
| --- | --- |
| 좌우 이동 | ← / → 또는 A / D |
| 소프트 드롭 | ↓ 또는 S, 길게 누르기 |
| 시계 방향 회전 | ↑ / W / X |
| 반시계 방향 회전 | Z |
| 하드 드롭 | Space |
| 보관 / 교환 | C 또는 Shift |
| 일시정지 / 계속 | P 또는 Esc |

헤더의 일시정지 버튼에서도 재시작할 수 있습니다. 앱이 백그라운드로 이동하거나 창이 포커스를 잃으면 자동으로 일시정지하고, 명시적으로 계속하기를 눌러야 재개하도록 구성했습니다. 소리는 기본적으로 꺼져 있습니다. 최고 점수와 소리 설정만 브라우저에 저장하며 저장이 차단된 환경의 예외도 처리합니다.

## 규칙

10 × 20의 보이는 보드와 상단 2개의 숨겨진 행, 7종 테트로미노, 7-bag 무작위 공급, 회전과 벽차기, 착지 예상 위치, 다음 3개 미리보기, 조각당 한 번의 보관을 구현합니다. 잠금 지연은 500ms이며 바닥에서 이동·회전으로 최대 15회 갱신할 수 있습니다. 10줄을 지울 때마다 레벨과 낙하 속도가 올라갑니다.

줄 삭제 기본 점수는 1/2/3/4줄에 각각 100/300/500/800 × 현재 레벨입니다. 연속 줄 삭제에는 두 번째부터 50 × 연속 횟수 × 레벨을 더합니다. 소프트 드롭은 칸당 1점, 하드 드롭은 칸당 2점입니다. T-spin 및 back-to-back 전용 판정은 포함하지 않습니다. 잠근 조각의 줄 삭제 후에도 숨겨진 행에 블록이 남거나 새 조각이 생성 위치에 들어갈 수 없으면 게임이 종료됩니다.

## 실행 및 구조

`site/index.html`을 브라우저에서 열면 됩니다. ES module, fetch, 빌드 단계가 없으므로 파일을 직접 여는 방식도 지원하도록 작성했습니다. 별도 서버나 패키지 설치는 필요 없습니다. 직접 파일을 여는 실행 방식은 이번 세션에서 실행해 보지 않았습니다.

- `site/index.html`: 접근 가능한 버튼, 점수판, 메뉴와 Canvas
- `site/style.css`: safe-area, 동적 viewport, 세로·가로 화면 레이아웃
- `site/engine.js`: DOM과 분리한 게임 규칙
- `site/app.js`: 렌더링, 포인터·키보드 입력, 소리와 저장
- `tests/engine.test.cjs`: Node 기본 테스트 러너 기반 규칙 테스트
- `.github/workflows/pages.yml`: 검사와 정적 파일 배포

테스트를 수동으로 실행하려면 Node.js 22 이상에서 `node --test tests/engine.test.cjs`를 사용합니다. 작성 과정에서는 로컬 실행 환경을 사용하지 않았습니다. 이번 자동 검사는 저장소의 GitHub Actions 안에서만 실행했으며, 테스트 통과를 실제 모바일 브라우저 플레이 검증으로 간주하지 않습니다.

## GitHub Pages 배포

`main`의 `site/`, `tests/`, workflow 변경을 push하거나 Actions에서 수동 실행하면 JavaScript 문법 검사와 엔진 테스트를 수행합니다. 이후 `site/`만 Pages artifact로 업로드하고 공식 `configure-pages` / `deploy-pages` 액션으로 게시합니다. 배포 후 라이브 HTML과 JavaScript 응답을 검사합니다. 모든 리소스 경로는 상대 경로이므로 repository 하위 경로에서도 동작하도록 구성합니다. 서비스 워커와 외부 CDN은 사용하지 않습니다. 문서만 변경하면 배포 workflow를 다시 실행하지 않습니다.

### 최초 활성화와 재실행

새 저장소에서 기본 `GITHUB_TOKEN`의 최초 Pages 생성이 거부되면 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택해야 합니다. 이 저장소는 사용자가 해당 설정을 완료했고, 이후 배포까지 성공했습니다.

기존 실패 run의 재실행에서 동일한 `github-pages` artifact가 두 개 생겨 배포가 실패했던 문제도 수정했습니다. 현재 workflow는 업로드와 배포에 동일한 `github-pages-${{ github.run_id }}-${{ github.run_attempt }}` 이름을 사용하도록 구성하여 실행·재시도별 artifact를 구분합니다. 수정된 workflow의 첫 배포는 성공했으며, 수정 후 재시도 자체를 별도로 검증한 것은 아닙니다.

수동 배포는 **Actions → Check and deploy Pages → Run workflow → main**으로 시작합니다. 과거 실패 run을 재실행하면 그 당시 commit의 workflow가 사용되므로, 수정된 설정으로 실행하려면 새 run을 시작하세요. 별도의 토큰을 코드에 저장하거나 권한 제한을 우회하지 않았습니다.

참조: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [configure-pages](https://github.com/actions/configure-pages).

## 범위

현대적인 모바일 Safari/Chrome 및 데스크톱 브라우저를 대상으로 작성했습니다. 화면 읽기 프로그램을 위한 점수·메뉴 의미 구조는 포함하지만 Canvas 게임 전체를 비시각적으로 플레이하는 인터페이스는 제공하지 않습니다. 현재 게임의 진행 상태는 저장하지 않습니다.

공식 Tetris 제품이 아닌 독립적인 학습용 구현입니다. 원작의 이미지, 음악, 로고 또는 코드를 사용하지 않습니다.
