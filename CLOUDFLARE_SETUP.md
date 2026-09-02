# Cloudflare 배포 순서

## 기존 사이트 업데이트 — 8월 추가

- 기존 `dailychecklist` 프로젝트의 파일만 교체하여 배포하세요.
- 현재 D1 데이터베이스와 DB 연결은 그대로 유지하세요. 데이터베이스를 새로 만들거나 초기화하지 마세요.
- 이번 수정은 2026년 8월 선택과 통계 범위만 추가합니다. 기존 기록 복원이나 전체 백업 불러오기는 필요하지 않습니다.
- 배포 후 연도 `2026`, 월 `8월`을 선택하세요. 9월 등 기존 기록은 해당 월에서 계속 확인할 수 있습니다.
- 과거 월을 선택한 동안에는 1분마다 현재 월로 돌아가지 않도록 수정했습니다.

## 최초 설치 시에만

1. Cloudflare의 **Storage & databases → D1 SQLite Database**에서 `rowoon-checklist-db`를 만듭니다.
2. Database ID `7fc1cca4-d34e-4b63-9f64-6b11d46f6ac7`은 이미 `wrangler.jsonc`에 연결되어 있습니다.
3. 이 폴더의 파일을 GitHub `rowoon-checklist` 저장소에 올립니다.
4. Cloudflare **Workers & Pages → Create application → Import a repository**에서 저장소를 선택합니다.
5. Build command는 `npm run build`, Deploy command는 `npx wrangler deploy`로 설정합니다.
6. 배포 사이트를 열어 2026년 8월 자료부터 작성합니다. 필요한 테이블은 첫 접속 때 자동 생성됩니다.
7. 최초 설정 후 **전체 백업 받기**로 백업 파일을 보관합니다.

저장은 브라우저에 즉시 임시 보관되고, 입력이 멈춘 뒤 약 5초 후 D1에 저장됩니다. 체크리스트는 이용인·월별 행으로 나뉘어 장기간 보관됩니다.
