# Cloudflare 배포 순서

1. Cloudflare의 **Storage & databases → D1 SQLite Database**에서 `rowoon-checklist-db`를 만듭니다.
2. Database ID `7fc1cca4-d34e-4b63-9f64-6b11d46f6ac7`은 이미 `wrangler.jsonc`에 연결되어 있습니다.
3. 이 폴더의 파일을 GitHub `rowoon-checklist` 저장소에 올립니다.
4. Cloudflare **Workers & Pages → Create application → Import a repository**에서 저장소를 선택합니다.
5. Build command는 `npm run build`, Deploy command는 `npx wrangler deploy`로 설정합니다.
6. 배포 사이트를 열어 2026년 9월 자료부터 작성합니다. 필요한 테이블은 첫 접속 때 자동 생성됩니다.
7. 최초 설정 후 **전체 백업 받기**로 백업 파일을 보관합니다.

저장은 브라우저에 즉시 임시 보관되고, 입력이 멈춘 뒤 약 5초 후 D1에 저장됩니다. 체크리스트는 이용인·월별 행으로 나뉘어 장기간 보관됩니다.
