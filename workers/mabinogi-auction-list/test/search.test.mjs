// mock 기반 회귀 테스트: 실제 Nexon API 호출 없이 fetch를 가로채서 검증한다.
// node --test 로 실행 (외부 테스트 프레임워크 의존성 추가하지 않음)
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';

let nextId = 1;
function mkItem({ item_name, item_display_name, category, price = 1000, options = [] }) {
    return {
        item_name,
        item_display_name,
        item_count: 1,
        auction_item_category: category,
        auction_price_per_unit: price,
        date_auction_expire: '2026-07-20T00:00:00.000Z',
        auction_buy_id: `mock-${nextId++}`,
        item_option: options,
    };
}

const MOCK_ITEMS = [
    // 둔기 - 정상 매물
    mkItem({ item_name: '@해머', item_display_name: '해머', category: '둔기', price: 1000 }),
    mkItem({ item_name: '@해머', item_display_name: '해머', category: '둔기', price: 1200 }),
    mkItem({ item_name: '켈틱 워 해머', item_display_name: '켈틱 워 해머', category: '둔기', price: 5000 }),
    // 오염 사례 재현: 이름에 "해머"가 들어있지만 카테고리가 다른 외형 주문서 (실측에서 실제로 확인된 패턴)
    mkItem({ item_name: '프론티어 뱅가드 빅 해머 외형 주문서', item_display_name: '프론티어 뱅가드 빅 해머 외형 주문서', category: '기타 스크롤', price: 800 }),

    // 인챈트 스크롤 - 합성 이름(item_display_name)으로 1차 keyword-search에서 바로 성공하는 부류
    mkItem({ item_name: '전용 인챈트 스크롤', item_display_name: '전용 인챈트 스크롤 - 벌레스크', category: '인챈트 스크롤', price: 300 }),
    mkItem({ item_name: '전용 인챈트 스크롤', item_display_name: '전용 인챈트 스크롤 - 벌레스크', category: '인챈트 스크롤', price: 350 }),
    mkItem({ item_name: '전용 인챈트 스크롤', item_display_name: '전용 인챈트 스크롤 - 무관심한', category: '인챈트 스크롤', price: 400 }),

    // 분양 메달 - 종족명이 옵션 값에만 있어 1차 검색은 0건, 폴백(기본이름 재검색+옵션필터)이 필요한 부류
    mkItem({
        item_name: '동물 캐릭터 분양 메달', item_display_name: '동물 캐릭터 분양 메달', category: '분양 메달', price: 10000,
        options: [{ option_type: '펫 정보', option_sub_type: '종족명', option_value: '잔망루피 알파카' }],
    }),
    mkItem({
        item_name: '동물 캐릭터 분양 메달', item_display_name: '동물 캐릭터 분양 메달', category: '분양 메달', price: 11000,
        options: [{ option_type: '펫 정보', option_sub_type: '종족명', option_value: '잔망루피 알파카' }],
    }),
    mkItem({
        item_name: '동물 캐릭터 분양 메달', item_display_name: '동물 캐릭터 분양 메달', category: '분양 메달', price: 9000,
        options: [{ option_type: '펫 정보', option_sub_type: '종족명', option_value: '북극의 도도한 폭스롯' }],
    }),

    // (Unknown) 계열 - item_name은 플레이스홀더, item_display_name이 실제 검색 가능한 텍스트
    mkItem({ item_name: '(Unknown)', item_display_name: '백화된 고혹적인 눈빛(오드아이) 뷰티 쿠폰(1회 거래 가능)', category: '뷰티 쿠폰', price: 50000 }),

    // 화이트리스트에 있어본 적 없는 임의의 새 카테고리 - 통일 로직이면 이것도 동일하게 동작해야 함
    mkItem({ item_name: '몰라던전 지도', item_display_name: '몰라던전 지도', category: '지도', price: 200 }),
];

function mockNexonFetch(requestedUrls) {
    return async (urlStr, options) => {
        requestedUrls.push(urlStr);
        const url = new URL(urlStr);
        assert.equal(url.hostname, 'open.api.nexon.com', `Nexon이 아닌 곳으로 요청됨: ${urlStr}`);
        assert.equal(options.headers['x-nxopen-api-key'], 'mock-api-key');

        let matched;
        if (url.pathname.endsWith('/keyword-search')) {
            const keyword = url.searchParams.get('keyword');
            matched = MOCK_ITEMS.filter(it =>
                (it.item_display_name && it.item_display_name.includes(keyword)) ||
                (it.item_name && it.item_name.includes(keyword))
            );
        } else if (url.pathname.endsWith('/list')) {
            const category = url.searchParams.get('auction_item_category');
            const itemNameParam = url.searchParams.get('item_name');
            // 새 설계에서는 /list에 item_name이 절대 실리면 안 됨(그 경로 자체가 삭제 대상)
            assert.equal(itemNameParam, null, '/list 요청에 item_name이 실림 — 삭제됐어야 할 direct-list 경로가 아직 남아있음');
            matched = category ? MOCK_ITEMS.filter(it => it.auction_item_category === category) : MOCK_ITEMS;
        } else {
            throw new Error(`예상치 못한 경로: ${urlStr}`);
        }

        return new Response(JSON.stringify({ auction_item: matched, next_cursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
}

function makeEnv(metadataProcessorSpy) {
    return {
        NEXON_API_KEY: 'mock-api-key',
        METADATA_PROCESSOR: {
            fetch: metadataProcessorSpy,
        },
    };
}

function makeCtx() {
    const waitUntilPromises = [];
    return {
        waitUntil(p) { waitUntilPromises.push(p); },
        async flush() { await Promise.all(waitUntilPromises); },
    };
}

async function runSearch(params, env, ctx) {
    const qs = new URLSearchParams(params).toString();
    const request = new Request(`https://api.mabidb.com/api/search/?${qs}`, {
        headers: { Origin: 'https://mabidb.com' },
    });
    const response = await worker.fetch(request, env, ctx);
    const body = await response.json();
    return { status: response.status, body };
}

// ── 1. 시나리오 1: 자동완성으로 아이템 선택 — 오염 없이 정확히 걸러지는지 ──

test('시나리오1: 일반 카테고리(둔기) - 카테고리 오염이 후처리로 제거된다', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const syncSpy = [];
    const env = makeEnv(async (...args) => { syncSpy.push(args); return new Response('[]', { status: 200 }); });
    const ctx = makeCtx();

    const { status, body } = await runSearch({ itemName: '해머', category: '둔기' }, env, ctx);
    await ctx.flush();

    assert.equal(status, 200);
    assert.equal(body.items.length, 3, '둔기 3건만 남아야 함(기타 스크롤 오염 제거)');
    assert.ok(body.items.every(it => it.auction_item_category === '둔기'), '결과에 둔기가 아닌 카테고리가 섞임');
    assert.equal(syncSpy.length, 0, '자동완성 검색인데 D1/KV 동기화가 호출됨');
});

test('시나리오1: 인챈트 스크롤(구 화이트리스트 카테고리) - 합성 이름으로 1차에 정확히 매칭', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ itemName: '전용 인챈트 스크롤 - 벌레스크', category: '인챈트 스크롤' }, env, ctx);

    assert.equal(body.items.length, 2, '벌레스크 매물 2건만 나와야 함(무관심한은 제외)');
    assert.ok(body.items.every(it => it.item_display_name === '전용 인챈트 스크롤 - 벌레스크'));
    // 1차 keyword-search만으로 끝나야 함(0건 폴백 안 탐) -> keyword-search 호출 1회
    const keywordCalls = requestedUrls.filter(u => u.includes('/keyword-search'));
    assert.equal(keywordCalls.length, 1, '합성 이름이 1차에 바로 맞았는데 불필요하게 재검색함');
});

test('시나리오1: 분양 메달(구 특수분기 카테고리) - 1차 0건 -> 폴백으로 종족 필터링', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ itemName: '동물 캐릭터 분양 메달 - 잔망루피 알파카', category: '분양 메달' }, env, ctx);

    assert.equal(body.items.length, 2, '잔망루피 알파카 매물 2건만 나와야 함(북극의 도도한 폭스롯 제외)');
    assert.ok(body.items.every(it => it.item_display_name === '동물 캐릭터 분양 메달 - 잔망루피 알파카'));
    // 1차(0건) + 폴백(기본이름) = keyword-search 2회 호출
    const keywordCalls = requestedUrls.filter(u => u.includes('/keyword-search'));
    assert.equal(keywordCalls.length, 2, '0건 폴백 로직이 정상 작동하지 않음(재검색이 안 일어남)');
});

test('시나리오1: (Unknown) item_name 계열 - 대표 이름(item_display_name)으로 정상 검색', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch(
        { itemName: '백화된 고혹적인 눈빛(오드아이) 뷰티 쿠폰(1회 거래 가능)', category: '뷰티 쿠폰' }, env, ctx
    );

    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].auction_item_category, '뷰티 쿠폰');
});

test('시나리오1: 화이트리스트에 있어본 적 없는 새 카테고리도 동일 로직으로 동작 (화이트리스트 삭제 검증)', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ itemName: '몰라던전 지도', category: '지도' }, env, ctx);

    assert.equal(body.items.length, 1);
    assert.equal(body.items[0].auction_item_category, '지도');
});

// ── 2. 불필요한 D1/KV 동기화 방지 검증 ──

test('동기화 분리: 자동완성 선택(시나리오1)은 결과가 있어도 동기화를 절대 트리거하지 않는다', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const syncCalls = [];
    const env = makeEnv(async (...args) => { syncCalls.push(args); return new Response('[]', { status: 200 }); });
    const ctx = makeCtx();

    // 화이트리스트였던 카테고리, 특수분기였던 카테고리, 일반 카테고리 전부 확인
    await runSearch({ itemName: '해머', category: '둔기' }, env, ctx);
    await runSearch({ itemName: '전용 인챈트 스크롤 - 벌레스크', category: '인챈트 스크롤' }, env, ctx);
    await runSearch({ itemName: '동물 캐릭터 분양 메달 - 잔망루피 알파카', category: '분양 메달' }, env, ctx);
    await ctx.flush();

    assert.equal(syncCalls.length, 0, '자동완성 검색 3건 중 하나 이상이 D1/KV 동기화를 호출함');
});

test('동기화 분리: 카테고리만 선택(시나리오2)도 동기화를 트리거하지 않는다', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const syncCalls = [];
    const env = makeEnv(async (...args) => { syncCalls.push(args); return new Response('[]', { status: 200 }); });
    const ctx = makeCtx();

    await runSearch({ category: '둔기' }, env, ctx);
    await ctx.flush();

    assert.equal(syncCalls.length, 0);
});

test('동기화 분리: 자유 텍스트 검색(시나리오3)만 동기화를 트리거한다', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const syncCalls = [];
    const env = makeEnv(async (url, opts) => {
        syncCalls.push({ url, body: JSON.parse(opts.body) });
        if (url.endsWith('/items/upsert')) {
            const items = JSON.parse(opts.body);
            return new Response(JSON.stringify(items.map(() => ({ representative_name: 'mock' }))), { status: 200 });
        }
        return new Response('ok', { status: 200 });
    });
    const ctx = makeCtx();

    const { body } = await runSearch({ keyword: '해머' }, env, ctx);
    await ctx.flush();

    assert.ok(body.items.length > 0);
    assert.equal(syncCalls.length, 2, '자유 텍스트 검색은 upsert + items 2단계 동기화가 호출돼야 함');
    assert.equal(syncCalls[0].url, 'https://metadata-processor/items/upsert');
    assert.equal(syncCalls[1].url, 'https://metadata-processor/items');
});

// ── 3. 시나리오3(자유 텍스트 검색) 회귀 없음 검증 ──

test('회귀 없음: keyword 파라미터 자유 텍스트 검색은 항상 /keyword-search로만 간다(카테고리 무시)', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    await runSearch({ keyword: '해머' }, env, ctx);
    await ctx.flush();

    assert.equal(requestedUrls.length, 1, '자유 텍스트 검색이 여러 번 호출됨 — 폴백/후처리 로직이 잘못 섞여 들어감');
    const url = new URL(requestedUrls[0]);
    assert.equal(url.pathname, '/mabinogi/v1/auction/keyword-search');
    assert.equal(url.searchParams.get('keyword'), '해머');
    assert.equal(url.searchParams.get('auction_item_category'), null, '자유 텍스트 검색에 카테고리 파라미터가 실리면 안 됨');
});

test('회귀 없음: 자유 텍스트 검색 결과는 카테고리 후처리 필터를 타지 않는다(오염 제거 로직 미적용, 기존과 동일)', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ keyword: '해머' }, env, ctx);
    await ctx.flush();

    // 둔기 3건 + 기타 스크롤(오염) 1건 = 4건 그대로 나와야 함 (자유 텍스트 검색은 원래도 필터링 안 했음)
    assert.equal(body.items.length, 4);
});

test('회귀 없음: itemName만 있고 category가 없는 경우도 자유 텍스트 검색(keyword-search)으로 처리(기존 동작)', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    await runSearch({ itemName: '해머' }, env, ctx);
    await ctx.flush();

    const url = new URL(requestedUrls[0]);
    assert.equal(url.pathname, '/mabinogi/v1/auction/keyword-search');
    assert.equal(url.searchParams.get('keyword'), '해머');
});

// ── 4. 기타 시나리오: 카테고리만 선택, 에러 전파, 파라미터 누락 ──

test('시나리오2: 카테고리만 선택하면 /list?auction_item_category만 호출', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ category: '둔기' }, env, ctx);

    assert.equal(requestedUrls.length, 1);
    const url = new URL(requestedUrls[0]);
    assert.equal(url.pathname, '/mabinogi/v1/auction/list');
    assert.equal(url.searchParams.get('auction_item_category'), '둔기');
    assert.equal(body.items.length, 3);
});

test('파라미터 누락 시 400 에러', async () => {
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();
    const request = new Request('https://api.mabidb.com/api/search/', { headers: { Origin: 'https://mabidb.com' } });
    const response = await worker.fetch(request, env, ctx);
    assert.equal(response.status, 400);
});

test('Nexon 에러는 그대로 전파된다(OPENAPI00001)', async () => {
    globalThis.fetch = async () => new Response(
        JSON.stringify({ error: { name: 'OPENAPI00001', message: '서버 오류' } }),
        { status: 500 }
    );
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { status, body } = await runSearch({ itemName: '해머', category: '둔기' }, env, ctx);
    assert.equal(status, 500);
    assert.ok(body.error.includes('서버 내부 오류'));
});

test('분양 메달 표시명 보강은 카테고리 문자열이 아니라 옵션 형태로 판단된다', async () => {
    const requestedUrls = [];
    globalThis.fetch = mockNexonFetch(requestedUrls);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ category: '분양 메달' }, env, ctx);

    assert.equal(body.items.length, 3);
    for (const it of body.items) {
        assert.ok(it.item_display_name.includes(' - '), '종족명이 표시명에 붙지 않음');
        assert.ok(!it.item_option.some(o => o.option_sub_type === '종족명'), '종족명 옵션이 제거되지 않음');
    }
});

// ── 5. 가격 오름차순 정렬 검증 (서버에서 정렬, 프론트는 더 이상 정렬하지 않음) ──

function mockUnsortedPriceFetch(items) {
    return async (urlStr, options) => {
        return new Response(JSON.stringify({ auction_item: items, next_cursor: null }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    };
}

test('정렬: 시나리오1(자동완성) 응답이 가격 오름차순으로 정렬된다', async () => {
    const unsorted = [
        mkItem({ item_name: '해머', item_display_name: '해머', category: '둔기', price: 5000 }),
        mkItem({ item_name: '해머', item_display_name: '해머', category: '둔기', price: 1000 }),
        mkItem({ item_name: '해머', item_display_name: '해머', category: '둔기', price: 3000 }),
    ];
    globalThis.fetch = mockUnsortedPriceFetch(unsorted);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ itemName: '해머', category: '둔기' }, env, ctx);

    assert.deepEqual(body.items.map(i => i.auction_price_per_unit), [1000, 3000, 5000]);
});

test('정렬: 시나리오2(카테고리만) 응답이 가격 오름차순으로 정렬된다', async () => {
    const unsorted = [
        mkItem({ item_name: 'A', item_display_name: 'A', category: '둔기', price: 700 }),
        mkItem({ item_name: 'B', item_display_name: 'B', category: '둔기', price: 200 }),
        mkItem({ item_name: 'C', item_display_name: 'C', category: '둔기', price: 400 }),
    ];
    globalThis.fetch = mockUnsortedPriceFetch(unsorted);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ category: '둔기' }, env, ctx);

    assert.deepEqual(body.items.map(i => i.auction_price_per_unit), [200, 400, 700]);
});

test('정렬: 시나리오3(자유 텍스트) 응답도 가격 오름차순으로 정렬된다', async () => {
    const unsorted = [
        mkItem({ item_name: 'A', item_display_name: 'A', category: '둔기', price: 900 }),
        mkItem({ item_name: 'B', item_display_name: 'B', category: '기타 스크롤', price: 100 }),
        mkItem({ item_name: 'C', item_display_name: 'C', category: '인챈트 스크롤', price: 500 }),
    ];
    globalThis.fetch = mockUnsortedPriceFetch(unsorted);
    const env = makeEnv(async () => new Response('[]', { status: 200 }));
    const ctx = makeCtx();

    const { body } = await runSearch({ keyword: '아무거나' }, env, ctx);
    await ctx.flush();

    assert.deepEqual(body.items.map(i => i.auction_price_per_unit), [100, 500, 900]);
});
