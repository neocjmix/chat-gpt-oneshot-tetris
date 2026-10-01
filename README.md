# NIGHT SHIFT — Pocket Tetris

모바일 터치와 데스크톱 키보드로 플레이하는 작은 테트리스 게임입니다. HTML, CSS, JavaScript와 Canvas 2D만 사용하며 런타임 의존성, 번들러, 계정, 백엔드가 없습니다.

**배포 주소:** https://neocjmix.github.io/chat-gpt-oneshot-tetris/  
이 주소는 GitHub Pages 배포가 성공한 뒤에만 사용할 수 있습니다. 저장소에 코드가 있다는 것과 실제 배포 성공은 별개입니다. 실제 진행 결과와 검증 범위는 `VERIFICATION.md`에 기록합니다.

## 플레이

모바일에서는 하단 버튼만으로 모든 조작이 가능합니다. 이동과 내리기 버튼은 길게 누르면 반복됩니다. 두 손가락으로 이동과 회전을 함께 입력할 수 있습니다. 하드 드롭은 별도 버튼으로 구분했습니다.

| 동작 | 키보드 |
| --- | --- |
| 좌우 이동 | ← / → 또는 A / D |
| 소프트 드롭 | ↓ 또는 S, 길게 누르기 |
| 시계 방향 회전 | ↑ / W / X |
| 반시계 방향 회전 | Z |
| 하드 드롭 | Space |
| 보관 / 교환 | C 또는 Shift |
| 일시정지 / 계속 | P 또는 Esc |

헤더의 일시정지 버튼에서도 재시작할 수 있습니다. 앱이 백그라운드로 이동하거나 창이 포커스를 잃으면 자동으로 일시정지하고, 명시적으로 계속하기를 눌러야 재개합니다. 소리는 기본적으로 꺼져 있습니다. 최고 점수와 소리 설정만 브라우저에 저장하며 저장이 차단된 환경에서도 플레이할 수 있도록 처리합니다.

## 규칙

10 × 20의 보이는 보드와 상단 2개의 숨겨진 행, 7종 테트로미노, 7-bag 무작위 공급, 회전과 벽차기, 착지 예상 위치, 다음 3개 미리보기, 조각당 한 번의 보관을 구현합니다. 잠금 지연은 500ms이며 바닥에서 이동·회전으로 최대 15회 갱신할 수 있습니다. 10줄을 지울 때마다 레벨과 낙하 속도가 올라갑니다.

줄 삭제 기본 점수는 1/2/3/4줄에 각각 100/300/500/800 × 현재 레벨입니다. 연속 줄 삭제에는 두 번째부터 50 × 연속 횟수 × 레벨을 더합니다. 소프트 드롭은 칸당 1점, 하드 드롭은 칸당 2점입니다. T-spin 및 back-to-back 전용 판정은 포함하지 않습니다. 잠근 조각의 줄 삭제 후에도 숨겨진 행에 블록이 남거나 새 조각이 생성 위치에 들어갈 수 없으면 게임이 종료됩니다.

## 실행 및 구조

`site/index.html`을 브라우저에서 열면 됩니다. ES module, fetch, 빌드 단계가 없으므로 파일을 직접 여는 방식도 지원하도록 작성했습니다. 별도 서버나 패키지 설치는 필요 없습니다.

- `site/index.html`: 접근 가능한 버튼, 점수판, 메뉴와 Canvas
- `site/style.css`: safe-area, 동적 viewport, 세로·가로 화면 레이아웃
- `site/engine.js`: DOM과 분리한 게임 규칙
- `site/app.js`: 렌더링, 포인터·키보드 입력, 소리와 저장
- `tests/engine.test.cjs`: Node 기본 테스트 러너 기반 규칙 테스트
- `.github/workflows/pages.yml`: 검사와 정적 파일 배포

테스트를 수동으로 실행하려면 Node.js 22 이상에서 `node --test tests/engine.test.cjs`를 사용합니다. 이 프로젝트 작성 과정에서는 로컬 실행 환경을 사용하지 않습니다. 자동 검사는 저장소의 GitHub Actions 안에서만 실행하며, 테스트 통과를 실제 모바일 브라우저 플레이 검증으로 간주하지 않습니다.

## GitHub Pages 배포

`main`에 push하거나 Actions에서 수동 실행하면 JavaScript 문법 검사와 엔진 테스트를 수행합니다. 이후 `site/`만 Pages artifact로 업로드하고 공식 `configure-pages` / `deploy-pages` 액션으로 게시합니다. 모든 리소스 경로는 상대 경로이므로 repository 하위 경로에서도 동작하도록 구성합니다. 서비스 워커와 외부 CDN은 사용하지 않습니다.

Pages 최초 활성화는 저장소 관리 설정입니다. 자동 활성화를 시도하더라도 기본 `GITHUB_TOKEN`에는 이 관리 권한이 없을 수 있습니다. 해당 단계가 권한 오류로 실패하면 저장소 **Settings → Pages → Build and deployment → Source → GitHub Actions**를 선택한 뒤 실패한 배포 job을 다시 실행해야 합니다. 활성화 실패를 배포 완료로 기록하지 않습니다. 별도의 토큰을 코드에 저장하거나 권한 제한을 우회하지 않습니다.

참조: [GitHub Pages custom workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [configure-pages](https://github.com/actions/configure-pages).

## 범위

현대적인 모바일 Safari/Chrome 및 데스크톱 브라우저를 대상으로 합니다. 화면 읽기 프로그램으로 점수와 메뉴를 읽을 수 있지만 Canvas 게임 전체를 비시각적으로 플레이하는 인터페이스는 제공하지 않습니다. 현재 게임의 진행 상태는 저장하지 않습니다.

공식 Tetris 제품이 아닌 독립적인 학습용 구현입니다. 원작의 이미지, 음악, 로고 또는 코드를 사용하지 않습니다.
