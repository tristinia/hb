/**
 * @module mabinogi-auction-list
 * @summary Cloudflare Worker를 사용한 통합 API 게이트웨이 (Pages Function 로직 통합)
 * @description /api/ 로 들어오는 모든 요청을 처리합니다. (mabinogi-auction-list, mabinogi-metadata-api 워커 통합)
 */

const NEXON_API_BASE_URL = "https://open.api.nexon.com/mabinogi/v1/auction";
const API_CONFIG = { MAX_PAGES: 100, DELAY_MS: 5 };
const KEYWORD_SEARCH_CATEGORIES = ['인챈트 스크롤', '도면', '옷본'];
const PET_MEDAL_CATEGORY = '분양 메달';

// 키워드 검색 결과가 이 개수를 넘으면(탐색성 검색으로 판단) 검색 인덱스 동기화를 스킵
const MAX_SYNC_ITEMS = 500;
const METADATA_SYNC_TIMEOUT_MS = 17500;

/**
 * JSON 응답 생성 헬퍼 함수
 */
function jsonResponse(data, status = 200, extraHeaders = {}) {
    const headers = {
        'Content-Type': 'application/json',
        ...extraHeaders,
    };
    return new Response(JSON.stringify(data), { status, headers });
}

/**
 * API 관련 오류 처리를 위한 사용자 정의 오류 클래스
 */
class ApiError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

/**
 * 넥슨 API 오류 코드를 사용자 친화적 메시지와 HTTP 상태 코드로 변환
 */
function mapNexonError(errorData, originalStatus) {
    const errorCode = errorData.error?.name;
    switch (errorCode) {
        case "OPENAPI00001": return { message: "서버 내부 오류가 발생했습니다.", statusCode: 500 };
        case "OPENAPI00004": return { message: "파라미터가 누락되었거나 유효하지 않습니다.", statusCode: 400 };
        case "OPENAPI00005": return { message: "유효하지 않은 API KEY 입니다.", statusCode: 401 };
        case "OPENAPI00007": return { message: "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", statusCode: 429 };
        case "OPENAPI00009": return { message: "데이터 준비 중입니다. 잠시 후 다시 시도해주세요.", statusCode: 503 };
        default: return { message: errorData.error?.message || "알 수 없는 API 오류가 발생했습니다.", statusCode: originalStatus };
    }
}

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const requestPath = url.pathname.startsWith('/api/') ? url.pathname.substring(5) : url.pathname.substring(1);
        const requestOrigin = request.headers.get('Origin');
        let allowedOrigin;

        // 요청 Origin이 허용된 Origin 목록에 있는지 확인하고, 있다면 해당 Origin을 허용합니다.
        if (requestOrigin === 'http://127.0.0.1:5500' || requestOrigin === 'https://mabidb.com') {
            allowedOrigin = requestOrigin;
        } else {
            // 그 외의 경우, 기본적으로 프로덕션 도메인을 허용합니다.
            allowedOrigin = 'https://mabidb.com';
        }
        const corsHeaders = { 'Access-Control-Allow-Origin': allowedOrigin };

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': allowedOrigin,
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, x-nxopen-api-key, accept',
                },
            });
        }

        try {
            // 신규: 전체 아이템 인덱스 제공 API
            if (requestPath.startsWith('items/index')) {
                return await handleItemIndexRequest(request, env, corsHeaders);
            }

            // 기존: 서버사이드 자동완성 로직 제거
            // if (requestPath.startsWith('search/autocomplete')) { ... }

            if (requestPath.startsWith('search/')) {
                return await handleUnifiedSearch(url, env, corsHeaders, ctx);
            }

            if (requestPath.startsWith('meta/')) {
                return await handleMetadataRequest(url, env, corsHeaders);
            }

            return jsonResponse({ error: '찾을 수 없는 API 경로입니다.' }, 404, corsHeaders);

        } catch (error) {
            console.error(`API 처리 중 오류 발생 (경로: ${requestPath}):`, error);
            const statusCode = error.statusCode || 500;
            const message = error.message || '서버 내부 오류가 발생했습니다.';
            return jsonResponse({ error: message }, statusCode, corsHeaders);
        }
    },
};

/**
 * 클라이언트 사이드 검색을 위한 전체 아이템 인덱스를 제공합니다.
 * KV에 1시간 동안 캐시하여 D1 부하를 최소화합니다.
 */
async function handleItemIndexRequest(request, env, corsHeaders) {
    const cacheKey = 'meta:search_index';
    const hashKey = `${cacheKey}:hash`;

    // 1. 클라이언트가 보낸 ETag 확인
    const clientEtag = request.headers.get('if-none-match');

    // 2. KV에서 데이터의 최신 해시(ETag) 조회
    const serverEtag = await env.MABINOGI_METADATA_CACHE.get(hashKey);

    // 3. ETag가 일치하면 304 Not Modified 응답
    if (clientEtag && serverEtag && clientEtag === serverEtag) {
        return new Response(null, {
            status: 304,
            headers: { ...corsHeaders, 'etag': serverEtag }
        });
    }

    // 4. KV에서 캐시된 인덱스 데이터 조회
    const searchIndexData = await env.MABINOGI_METADATA_CACHE.get(cacheKey, 'json');
    
    if (searchIndexData && searchIndexData.items) {
        // 클라이언트가 기대하는 순수 배열 형태로 전달합니다.
        const items = searchIndexData.items;

        // 응답 헤더에 ETag와 캐시 컨트롤 추가
        const cacheHeaders = {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'etag': serverEtag || 'no-hash', // 해시가 없는 경우를 대비
            'X-Cache-Status': 'HIT'
        };
        return jsonResponse(items, 200, cacheHeaders);
    }

    // 캐시가 없는 경우 (매우 드문 경우, 메타데이터 생성 프로세스가 아직 실행되지 않음)
    // 이 워커는 데이터를 직접 생성하지 않고, 빈 배열과 함께 오류를 기록합니다.
    console.error(`[Critical] KV cache MISS for key: ${cacheKey}. Metadata generation process might be failing.`);
    return jsonResponse([], 404, { ...corsHeaders, 'X-Cache-Status': 'MISS' });
}

async function handleUnifiedSearch(url, env, corsHeaders, ctx) {
    const apiKey = env.NEXON_API_KEY;
    if (!apiKey) {
        console.error("NEXON_API_KEY secret is not set.");
        return jsonResponse({ error: "서버 설정 오류: API 키가 없습니다" }, 500, corsHeaders);
    }

    const itemName = url.searchParams.get('itemName');
    const category = url.searchParams.get('category');
    const keyword = url.searchParams.get('keyword');

    if (!itemName && !category && !keyword) {
        throw new ApiError("검색 파라미터(itemName, category, keyword) 중 하나 이상 필요", 400);
    }

    const { url: initialUrl, isPetMedalSearch, isKeywordOnlySearch } = buildNexonApiUrl(itemName, category, keyword);
    const allItems = await fetchAllPagesFromNexonApi(initialUrl.toString(), apiKey);
    const finalItems = processAndFilterResults(allItems, isPetMedalSearch, itemName);
    const availableFilters = generateAvailableFilters(finalItems);

    // 사용자 응답은 절대 기다리지 않음(fire-and-forget), 실패해도 검색 자체엔 영향 없음
    if (isKeywordOnlySearch && allItems.length > 0) {
        if (allItems.length <= MAX_SYNC_ITEMS) {
            ctx.waitUntil(
                syncSearchResultsToMetadataProcessor(env, allItems).catch(err =>
                    console.error('metadata-processor 검색 결과 동기화 실패:', err)
                )
            );
        } else {
            console.log(`검색 결과 ${allItems.length}건 > ${MAX_SYNC_ITEMS}, 인덱스 동기화 스킵 (탐색성 검색으로 판단)`);
        }
    }

    return jsonResponse({
        items: finalItems,
        availableFilters: availableFilters
    }, 200, corsHeaders);
}

function buildNexonApiUrl(itemName, category, keyword) {
    let url;
    let isPetMedalSearch = false;
    let isKeywordOnlySearch = false;

    if (itemName && category) {
        if (KEYWORD_SEARCH_CATEGORIES.includes(category)) {
            url = new URL(`${NEXON_API_BASE_URL}/keyword-search`);
            url.searchParams.set('keyword', itemName);
        } else if (category === PET_MEDAL_CATEGORY) {
            url = new URL(`${NEXON_API_BASE_URL}/list`);
            url.searchParams.set('auction_item_category', category);
            isPetMedalSearch = true;
        } else {
            url = new URL(`${NEXON_API_BASE_URL}/list`);
            url.searchParams.set('auction_item_category', category);
            url.searchParams.set('item_name', itemName);
        }
    } else if (category) {
        url = new URL(`${NEXON_API_BASE_URL}/list`);
        url.searchParams.set('auction_item_category', category);
    } else {
        // 순수 키워드 검색 — 신규 아이템 검색 인덱스 동기화 대상
        url = new URL(`${NEXON_API_BASE_URL}/keyword-search`);
        url.searchParams.set('keyword', keyword || itemName);
        isKeywordOnlySearch = true;
    }
    return { url, isPetMedalSearch, isKeywordOnlySearch };
}

/**
 * 키워드 검색 결과(원본, 가공 전)를 metadata-processor에 동기화
 * 1. /items/upsert (await) → D1 items 테이블 저장, item_id/representative_name 수신
 * 2. 받은 representative_name을 각 아이템에 재결합
 * 3. /items (await) → KV 검색 인덱스 갱신 + 신규 있으면 CDN 자동 퍼지
 * 호출자가 이미 ctx.waitUntil로 감싸서 fire-and-forget 처리하므로, 여기서는 순서 보장을 위해 그대로 await 체인으로 작성
 * @param {object} env - 워커 환경 변수 및 바인딩
 * @param {Array} rawItems - Nexon이 반환한 원본 아이템 배열 (가공 전)
 */
async function syncSearchResultsToMetadataProcessor(env, rawItems) {
    if (!env.METADATA_PROCESSOR) {
        console.warn('METADATA_PROCESSOR 서비스 바인딩 미설정, 검색 결과 동기화 스킵');
        return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), METADATA_SYNC_TIMEOUT_MS);

    try {
        const upsertResponse = await env.METADATA_PROCESSOR.fetch('https://metadata-processor/items/upsert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rawItems),
            signal: controller.signal,
        });

        if (!upsertResponse.ok) {
            const body = await upsertResponse.text().catch(() => '');
            console.error('metadata-processor items/upsert 실패', { status: upsertResponse.status, itemCount: rawItems.length, body });
            return;
        }

        const upsertResults = await upsertResponse.json();
        if (!Array.isArray(upsertResults) || upsertResults.length !== rawItems.length) {
            console.error('metadata-processor items/upsert 응답 형식 불일치', {
                itemCount: rawItems.length,
                resultCount: Array.isArray(upsertResults) ? upsertResults.length : typeof upsertResults,
            });
            return;
        }

        // representative_name을 재결합하지 않으면 /items가 item_name(오염 가능)으로 폴백됨
        const itemsWithRepresentativeName = rawItems.map((item, i) => ({
            ...item,
            representative_name: upsertResults[i].representative_name,
        }));

        const indexResponse = await env.METADATA_PROCESSOR.fetch('https://metadata-processor/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(itemsWithRepresentativeName),
            signal: controller.signal,
        });

        if (!indexResponse.ok) {
            console.error('metadata-processor items(검색 인덱스 갱신) 실패', { status: indexResponse.status, itemCount: rawItems.length });
            return;
        }

        console.log(`검색 결과 ${rawItems.length}건 metadata-processor 동기화 완료`);
    } catch (error) {
        const reason = error.name === 'AbortError' ? `타임아웃(${METADATA_SYNC_TIMEOUT_MS}ms)` : error.message;
        console.error('metadata-processor 동기화 중 오류 발생', { reason, itemCount: rawItems.length });
    } finally {
        clearTimeout(timeoutId);
    }
}

function processAndFilterResults(items, isPetMedalSearch, itemName) {
    const processedItems = items.map(item => {
        if (item.auction_item_category === PET_MEDAL_CATEGORY && item.item_option) {
            const petRaceOptionIndex = item.item_option.findIndex(opt => opt.option_type === '펫 정보' && opt.option_sub_type === '종족명');
            if (petRaceOptionIndex > -1) {
                const petRaceOption = item.item_option[petRaceOptionIndex];
                if (petRaceOption.option_value) {
                    const newItem = { ...item, item_display_name: `${item.item_name} - ${petRaceOption.option_value}` };
                    newItem.item_option = newItem.item_option.filter((_, index) => index !== petRaceOptionIndex);
                    return newItem;
                }
            }
        }
        return item;
    });

    if (isPetMedalSearch) {
        const petRaceFilter = itemName ? itemName.split(' - ')[1] : null;
        return petRaceFilter
            ? processedItems.filter(item => item.item_display_name?.toLowerCase().includes(petRaceFilter.toLowerCase()))
            : processedItems.filter(item => item.auction_item_category === PET_MEDAL_CATEGORY);
    }

    return processedItems;
}

async function fetchAllPagesFromNexonApi(initialUrl, apiKey) {
    let allItems = [];
    let currentUrl = initialUrl;
    let pageCount = 0;

    while (currentUrl && pageCount < API_CONFIG.MAX_PAGES) {
        pageCount++;
        if (pageCount > 1) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.DELAY_MS));
        }

        const response = await fetch(currentUrl, {
            headers: { 'accept': 'application/json', 'x-nxopen-api-key': apiKey },
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: { message: "알 수 없는 API 오류" } }));
            const { message } = mapNexonError(errorData, response.status);
            throw new ApiError(`API 호출 실패 (페이지 ${pageCount}): ${message}`, response.status);
        }

        const pageData = await response.json().catch(() => { throw new ApiError("API 응답 JSON 파싱 실패", 500) });
        if (pageData.auction_item?.length > 0) {
            allItems = allItems.concat(pageData.auction_item);
        }

        if (pageData.next_cursor) {
            const url = new URL(currentUrl);
            url.searchParams.set('cursor', pageData.next_cursor);
            currentUrl = url.toString();
        } else {
            currentUrl = null;
        }
    }

    return allItems;
}

function generateAvailableFilters(items) {
    const foundOptionTypes = new Set();
    if (!items || items.length === 0) {
        return [];
    }

    for (const item of items) {
        if (item.item_option && Array.isArray(item.item_option)) {
            for (const option of item.item_option) {
                if (option.option_type === '펫 정보' && option.option_sub_type && option.option_sub_type !== '종족명') {
                    foundOptionTypes.add(`펫 정보: ${option.option_sub_type}`);
                }
                else if (option.option_type && option.option_type !== '펫 정보') {
                    foundOptionTypes.add(option.option_type);
                }
            }
        }
    }

    return Array.from(foundOptionTypes);
}

async function handleMetadataRequest(url, env, corsHeaders) {
    const path = url.pathname.replace('/api/meta/', ''); // 'enchants', 'reforges' 등
    const category = url.searchParams.get('category');

    let kvKey;
    let isCombinedEnchants = false;

    if (path === 'enchants') {
        kvKey = 'meta:enchants_combined';
        isCombinedEnchants = true;
    } else if (path === 'reforges' && category) {
        kvKey = `meta:reforge:${encodeURIComponent(category)}`;
    } else if (path === 'set-effects' && category) {
        kvKey = `meta:seteffect:${encodeURIComponent(category)}`;
    } else if (path === 'ecostones' && category) {
        kvKey = `meta:ecostone:${encodeURIComponent(category)}`;
    } else {
        return jsonResponse({ error: '유효하지 않은 메타데이터 요청입니다.' }, 400, corsHeaders);
    }

    const cachedData = await env.MABINOGI_METADATA_CACHE.get(kvKey, 'json');

    if (cachedData) {
        // CDN과 브라우저에 1시간(3600초) 동안 캐시하도록 헤더를 추가합니다.
        const cacheHeaders = {
            ...corsHeaders,
            'Cache-Control': 'public, max-age=3600, s-maxage=3600',
            'X-Cache-Status': 'HIT'
        };
        return jsonResponse(cachedData, 200, cacheHeaders);
    }

    console.warn(`메타데이터 캐시 미스: ${kvKey}`);
    const emptyResponse = isCombinedEnchants ? { prefix: {}, suffix: {} } : [];
    return jsonResponse(emptyResponse, 404, { ...corsHeaders, 'X-Cache-Status': 'MISS' });
}