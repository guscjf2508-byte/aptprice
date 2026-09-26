# 전월세 버전으로 업데이트

이 묶음은 로컬 완성본입니다. GitHub에 올리기 전까지 공개 사이트는 바뀌지 않습니다.

## 1. 일반 파일 덮어 올리기

1. 배포 ZIP을 새 폴더에 압축 해제합니다.
2. https://github.com/guscjf2508-byte/aptprice 에서 Code → Add file → Upload files를 누릅니다.
3. 아래 폴더와 파일을 저장소 최상위에 끌어 놓습니다. ZIP 자체나 바깥쪽 폴더를 올리지 마세요.
   - `dist` 폴더 전체
   - `scripts` 폴더 전체 (새로 추가된 API 갱신 기능)
   - `tests` 폴더 전체
   - `build-offline.mjs`, `offline.html`, `package.json`, `server.mjs`, `README.md`
4. Commit changes로 저장합니다.

원본 엑셀은 업로드하지 않습니다. 인증키는 이 파일 묶음에 들어 있지 않습니다.

## 2. 배포 설정 교체 — 이번 업데이트에 필수

`.github` 폴더 업로드가 어려우면 파일 내용을 직접 바꾸세요.

1. https://github.com/guscjf2508-byte/aptprice/blob/main/.github/workflows/pages.yml 을 엽니다.
2. 연필 아이콘(Edit)을 누릅니다.
3. 압축 해제 폴더의 **배포설정_pages.yml.txt**를 메모장으로 엽니다.
4. 그 내용 전체를 복사해서 GitHub 편집창의 기존 내용 전체와 교체합니다.
5. Commit changes로 저장합니다.

파일이 없으면 https://github.com/guscjf2508-byte/aptprice/new/main?filename=.github%2Fworkflows%2Fpages.yml 에서 만드세요.
정확한 경로는 **`.github/workflows/pages.yml`**입니다. `dist/workflows`가 아닙니다.

## 3. 인증키 및 Pages 설정 확인

- https://github.com/guscjf2508-byte/aptprice/settings/secrets/actions 에 **REB_API_KEY**가 있으면 그대로 사용합니다. 없다면 New repository secret으로 등록합니다.
- https://github.com/guscjf2508-byte/aptprice/settings/pages 에서 Source가 **GitHub Actions**인지 확인합니다.

## 4. 배포 실행

1. https://github.com/guscjf2508-byte/aptprice/actions 에서 **Deploy real estate analyzer**를 선택합니다.
2. Run workflow → main → Run workflow를 누릅니다.
3. 초록색 체크가 되면 https://guscjf2508-byte.github.io/aptprice/ 에서 Ctrl+F5로 새로고침합니다.
4. 최상단 **매매 / 전월세** 탭이 보이는지 확인하고 전월세 원본을 선택합니다.

화면 파일만 올리고 2번 배포 설정을 교체하지 않으면 전환율 자동 갱신은 작동하지 않습니다.

## 이후 전환율 갱신

- 매일 한국시간 오전 7시 30분을 기준으로 GitHub Actions가 공식 API를 확인하고 배포합니다. GitHub 실행 상황에 따라 지연될 수 있습니다.
- 즉시 갱신하려면 동일한 Run workflow를 누릅니다.
- API 오류·잘못된 키·불완전한 데이터가 있으면 배포를 중단하고 이전 공개 사이트를 유지합니다. Actions의 실패한 실행에서 오류를 확인합니다.
- 저장소 파일에 매일 변경 내용을 커밋하지 않습니다. 갱신된 전환율은 배포 결과물에 포함됩니다. GitHub에서 ZIP으로 내려받은 소스의 전환율은 마지막 수동 업로드 시점일 수 있습니다.
- 최신 단일 HTML이 필요하면 배포 사이트의 `/offline.html`을 브라우저에서 저장해 사용합니다. 저장한 파일은 자동 갱신되지 않습니다.
- 인증키는 GitHub에서만 사용하고 사용자 브라우저에는 전송하지 않습니다. 거래 엑셀은 브라우저 안에서만 처리합니다.

## 분석 기준

- 전세는 보증금 그대로, 월세는 `보증금 + 월세 × 12 ÷ (전환율/100)`으로 환산합니다.
- 계약월별 통계가 아니라 **주택유형별 최신 공표월**을 모든 계약에 적용해 비교합니다. 기준월과 갱신일은 화면에 표시합니다.
- 아파트에는 아파트 전환율, 오피스텔에는 오피스텔 전환율(전체 면적)을 적용합니다.
- 실제 주소의 시군구 → 시 → 시도 순서로 일치하는 통계를 찾습니다. 상위 지역을 사용하면 개별 사례와 출처에 표시합니다. 오피스텔 서울 권역 통계는 임의로 구에 연결하지 않고 서울 통계를 사용합니다.
- 지역 통계가 없으면 전국 수치로 임의 대체하지 않습니다. 원보증금·월세·거래 건수는 남기고 환산값은 비우며, 환산평균과 그래프에서 제외합니다. ‘환산 불가 건수’를 함께 표시합니다.
- 전월세 원본에는 중개사 소재지·거래유형이 없어 매매의 직거래·타지역 중개사 제외를 적용할 수 없습니다. 입력값 오류와 확인 가능한 해제 거래를 제외합니다.
- ‘신규·갱신’ 원본 빈칸과 `-`는 ‘미기재’로 분리하며, 갱신요구권 사용 여부와 혼동하지 않습니다.
- 월세 화면의 평균 보증금·평균 월세는 서로 다른 계약 조건의 단순 평균입니다. 환산 전세 평당가는 지역별 시장 비교용 참고 지표이며 법정 전환율이 아닙니다.

공식 API 문서: https://www.reb.or.kr/r-one/portal/openapi/openApiDevPage.do
