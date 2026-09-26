"""Fetch only public REB statistics; credentials are read from the environment."""
import datetime as dt
import json
import os
from pathlib import Path
import sys
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parent.parent

def update():
    key = os.environ.get('REB_API_KEY', '').strip()
    if not key or key == 'sample':
        raise ValueError('GitHub Secrets에 REB_API_KEY를 등록해 주세요.')
    today = dt.datetime.now(dt.timezone.utc).date()
    start = (today - dt.timedelta(days=550)).strftime('%Y%m')
    configs = json.loads((ROOT / 'scripts/rate-config.json').read_text(encoding='utf-8'))
    records, tables = [], []
    for cfg in configs:
        collected = []
        for page in range(1, 101):
            params = dict(KEY=key, Type='json', STATBL_ID=cfg['table'], ITM_ID=cfg['item'],
                          DTACYCLE_CD='MM', START_WRTTIME=start, pIndex=page, pSize=1000, **cfg['extra'])
            url = 'https://www.reb.or.kr/r-one/openapi/SttsApiTblData.do?' + urllib.parse.urlencode(params)
            try:
                with urllib.request.urlopen(url, timeout=60) as response:
                    data = json.load(response)
            except Exception:
                raise ValueError('R-ONE 연결 실패. 이전 공개 사이트는 유지됩니다.') from None
            blocks = data.get('SttsApiTblData', [])
            heads = [h for b in blocks for h in b.get('head', [])]
            if not any(h.get('RESULT', {}).get('CODE') == 'INFO-000' for h in heads):
                raise ValueError('R-ONE 응답 오류: 인증키 및 통계표 이용 가능 여부를 확인하세요.')
            total = next(h['list_total_count'] for h in heads if 'list_total_count' in h)
            rows = [row for b in blocks for row in b.get('row', [])]
            if not rows:
                raise ValueError('R-ONE 페이지 누락. 배포를 중단합니다.')
            collected.extend(rows)
            if len(collected) >= total:
                break
        else:
            raise ValueError('R-ONE 조회 한도 초과')
        # Use one publication month per property type; never silently mix months.
        latest = max(str(x['WRTTIME_IDTFR_ID']) for x in collected)
        if len(latest) != 6 or not latest.isdigit() or latest > today.strftime('%Y%m'):
            raise ValueError('통계 기준월 확인 필요')
        recent = [x for x in collected if str(x['WRTTIME_IDTFR_ID']) == latest]
        seen = set()
        for row in recent:
            if str(row['ITM_ID']) != cfg['item'] or row.get('UI_NM') != '%':
                raise ValueError('전환율 항목 또는 단위 변경 감지')
            region_id = str(row['CLS_ID'] if cfg['kind'] == '아파트' else row['GRP_ID'])
            region = row.get('CLS_FULLNM') if cfg['kind'] == '아파트' else row.get('GRP_FULLNM')
            if not region:
                region = cfg['regions'].get(region_id)
            if not region or region_id in seen:
                raise ValueError('지역 코드 누락 또는 중복')
            seen.add(region_id)
            value = row.get('DTA_VAL')
            if value is None or str(value).strip() in ('', '-', '…'):
                continue
            value = float(value)
            if not 0 < value < 100:
                raise ValueError('전환율 범위 오류')
            records.append(dict(kind=cfg['kind'], region=region, rate=value,
                                month=latest[:4]+'-'+latest[4:], table=cfg['table']))
        valid = [x for x in records if x['kind'] == cfg['kind']]
        if len(valid) < 8 or not any(x['region'] == '서울' for x in valid):
            raise ValueError('지역별 자료 불완전: 이전 사이트를 유지합니다.')
        tables.append(dict(kind=cfg['kind'], table=cfg['table'], month=latest[:4]+'-'+latest[4:]))
    payload = dict(source='한국부동산원 R-ONE', fetchedAt=dt.datetime.now(dt.timezone.utc).isoformat(), tables=tables, records=records)
    output = 'globalThis.REB_RATES = ' + json.dumps(payload, ensure_ascii=False, allow_nan=False) + ';\n'
    target = ROOT / 'dist/rates.js'
    temporary = target.with_suffix('.tmp')
    temporary.write_text(output, encoding='utf-8')
    temporary.replace(target)
    print('전환율 갱신 완료:', ', '.join(x['kind']+' '+x['month'] for x in tables), len(records), '지역 항목')

if __name__ == '__main__':
    try:
        update()
    except Exception as exc:
        # Never include request URLs or credentials in logs.
        print(str(exc) if isinstance(exc, ValueError) else '전환율 갱신 실패: 응답 형식을 확인하세요.', file=sys.stderr)
        sys.exit(1)
