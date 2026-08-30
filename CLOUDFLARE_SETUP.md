# Cloudflare 배포 순서

1. Cloudflare의 **Storage & databases → D1 SQLite Database**에서 `rowoon-checklist-db`를 만듭니다.
2. 새 데이터베이스 Overview 화면의 **Database ID**를 복사합니다.
3. `wrangler.jsonc`의 `D1_DATABASE_ID_REPLACE_ME`를 복사한 ID로 바꿉니다.
4. D1의 **Console**에서 `schema.sql` 안의 SQL 문 전체를 붙여넣고 **Execute**를 누릅니다.
5. 이 폴더의 파일을 GitHub `rowoon-checklist` 저장소에 올립니다.
6. Cloudflare **Workers & Pages → Create application → Import a repository**에서 저장소를 선택합니다.
7. Build command는 `npm run build`, Deploy command는 `npx wrangler deploy`로 설정합니다.
8. 배포 사이트를 열어 2026년 9월 자료부터 작성합니다.
9. 최초 설정 후 **전체 백업 받기**로 백업 파일을 보관합니다.

저장은 브라우저에 즉시 임시 보관되고, 입력이 멈춘 뒤 약 5초 후 D1에 저장됩니다. 체크리스트는 이용인·월별 행으로 나뉘어 장기간 보관됩니다.
