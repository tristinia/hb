/**
 * @module mabinogi-metadata-processor
 * @summary 생산자 Worker로부터 아이템 데이터를 받아 메타데이터를 파싱하고 D1/KV에 저장하는 중앙 처리소
 * @description Service Binding을 통해 fetch 요청으로 데이터를 받아 처리
 */

import { getRepresentativeItemName } from '../../shared/item-identity.js';

// 메타데이터 유형별 설정
const METADATA_CONFIG = {
    'search-index': { // 검색 인덱스 생성 설정 추가
        dbTable: 'items',
        kvKey: 'meta:search_index',
        kvHashKey: 'meta:search_index:hash',
        cronEnabled: true, // Cron 트리거로 독립 실행 가능하도록 설정
    },
    reforge: {
        dbTable: 'reforges',
        groupColumn: 'category',
        kvKey: 'meta:reforges_all',
        kvHashKey: 'meta:reforges_all:hash',
        optionType: '세공 옵션',
        parseOption: (option) => option.option_value.replace(/\s*\(.*\)/, '').trim(),
    },
    'set-effect': {
        dbTable: 'set_effects',
        groupColumn: 'category',
        kvKey: 'meta:seteffects_all',
        kvHashKey: 'meta:seteffects_all:hash',
        optionType: '세트 효과',
        parseOption: (option) => option.option_value,
    },
    ecostone: {
        dbTable: 'ecostones',
        groupColumn: 'type',
        kvKey: 'meta:ecostones_all',
        kvHashKey: 'meta:ecostones_all:hash',
        optionType: '에코스톤 각성 능력',
        // option: 옵션 객체, item: 아이템 객체
        parseOption: (option, item) => ({
            type: item.item_name.replace(' 에코스톤', ''), // '레드 에코스톤' -> '레드'
            name: option.option_value.replace(/\s*\d+\s*레벨$/, '').trim() // "컴뱃 마스터리 최대 대미지 19 레벨" -> "컴뱃 마스터리 최대 대미지"
        }),
    },
    enchant: { // 인챈트 설정도 명시적으로 추가
        dbTable: 'enchants',
        kvKey: 'meta:enchants_combined',
        optionType: '인챈트',
    }
};

export default {
    /**
     * Cron 트리거로 주기적으로 실행되어 전체 검색 인덱스를 갱신
     */
    async scheduled(event, env, ctx) {
        console.log(`[${new Date().toISOString()}] Cron 트리거로 검색 인덱스 증분 갱신 시작.`);
        try {
            const LAST_PROCESSED_ID_KEY = 'meta:search_index:last_id';
            const lastProcessedId = await env.MABINOGI_METADATA_CACHE.get(LAST_PROCESSED_ID_KEY) || '0';

            // 마지막으로 처리한 ID 이후의 새로운 아이템만 D1에서 가져옵니다.
            const { results: newItems } = await env.mabinogi_auction_db
                .prepare("SELECT id, name, category FROM items WHERE id > ? ORDER BY id ASC")
                .bind(lastProcessedId)
                .all();

            if (newItems.length > 0) {
                await handleSearchIndexUpdate(env, newItems, false); // isFullRebuild = false로 증분 업데이트
                const latestId = newItems[newItems.length - 1].id;
                await env.MABINOGI_METADATA_CACHE.put(LAST_PROCESSED_ID_KEY, latestId.toString());
                console.log(`검색 인덱스 증분 갱신 완료. 마지막 처리 ID: ${latestId}`);
            } else {
                console.log('새로 추가된 아이템이 없어 검색 인덱스를 갱신하지 않습니다.');
            }
        } catch (error) {
            console.error('Cron 작업 중 오류 발생:', error);
        }
    },

    /**
     * Service Binding을 통해 다른 Worker로부터 호출되는 핸들러
     */
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // D1 items 테이블 upsert 전용 경로 (기존 기본 경로/동작에는 영향 없음)
        if (url.pathname === '/items/upsert') {
            return handleItemsUpsertRequest(request, env);
        }

        // 운영용 요청 크기 제한 (안정성)
        const MAX_ITEMS = 5000;

        if (request.method !== 'POST') {
            return new Response('POST 요청만 허용', { status: 405 });
        }

        try {
            const allItems = await request.json();
            if (!Array.isArray(allItems)) {
                return new Response('유효한 아이템 배열 필요', { status: 400 });
            }
            if (allItems.length === 0) {
                return new Response('아이템 목록이 비어있음', { status: 400 });
            }
            if (allItems.length > MAX_ITEMS) {
                console.warn(`요청 아이템 수 ${allItems.length}이 제한(${MAX_ITEMS}) 초과`);
                return new Response(`아이템 수 제한 초과: ${MAX_ITEMS}`, { status: 413 });
            }
            console.log(`[${new Date().toISOString()}] ${allItems.length}개의 아이템에 대한 메타데이터 처리 시작.`);

            // 인챈트, 세공, 세트 효과 메타데이터 처리
            // waitUntil을 사용하여 응답을 기다리지 않고 비동기 처리
            ctx.waitUntil(Promise.all([
                handleEnchantUpdate(env, allItems),
                handleMetadataUpdate(env, allItems, METADATA_CONFIG.reforge, '세공 옵션'),
                handleMetadataUpdate(env, allItems, METADATA_CONFIG['set-effect'], '세트 효과'),
                handleMetadataUpdate(env, allItems, METADATA_CONFIG.ecostone, '에코스톤'),
                handleSearchIndexUpdate(env, allItems) // 검색 인덱스 업데이트 핸들러 추가
            ]));

            return new Response('메타데이터 처리 작업 예약됨', { status: 202 });

        } catch (error) {
            console.error("메타데이터 처리 중 오류 발생:", error);
            return new Response('데이터 처리 중 오류 발생', { status: 500 });
        }
    },
};

/**
 * 검색용 인덱스 생성 및 KV 저장
 * @param {object} env - 워커 환경 변수
 * @param {Array} allItems - 아이템 목록
 */
async function handleSearchIndexUpdate(env, allItems, isFullRebuild = false) {
    console.log('검색 인덱스 생성을 시작합니다.');
    const SEARCH_INDEX_KEY = METADATA_CONFIG['search-index'].kvKey;
    const SEARCH_INDEX_HASH_KEY = `${SEARCH_INDEX_KEY}:hash`;
    let searchIndex;

    if (isFullRebuild) {
        // 전체 재빌드 모드: 기존 인덱스를 무시하고 새로 생성
        searchIndex = {
            items: [], // { name: string, category: string, chosung: string }
            // 카테고리 데이터는 별도 파일(categories.json)에서 로드되므로 여기서는 제외하거나,
            // 필요하다면 D1에서 직접 읽어와 추가할 수 있습니다.
        };
        console.log('전체 재빌드 모드로 검색 인덱스를 새로 생성합니다.');
    } else {
        // 증분 업데이트 모드: 기존 인덱스를 로드하여 새로운 아이템만 추가
        searchIndex = await env.MABINOGI_METADATA_CACHE.get(SEARCH_INDEX_KEY, 'json');
        if (!searchIndex) {
            searchIndex = { items: [] };
        }
    }

    const existingNames = new Set(searchIndex.items.map(item => item.name));
    let newItemsCount = 0;

    allItems.forEach(item => {
        // D1에서 읽어온 데이터는 `item.name`, 히스토리 워커에서 받은 데이터는
        // 정제된 `item.representative_name`(우선) 또는 원본 `item.item_name`(fallback)
        const name = item.name || item.representative_name || item.item_name;
        if (!name || existingNames.has(name)) {
            return; // 이름이 없거나 이미 인덱스에 있으면 건너뛰기
        }

        searchIndex.items.push({
            name: name,
            category: item.category || item.auction_item_category
        });
        existingNames.add(name);
        newItemsCount++;
    });

    if (newItemsCount > 0 || isFullRebuild) {
        // 4. 해시를 비교하여 변경되었을 때만 KV에 저장합니다.
        const newIndexJson = JSON.stringify(searchIndex);
        const newIndexHash = await generateSha256(newIndexJson);

        const oldIndexHash = await env.MABINOGI_METADATA_CACHE.get(SEARCH_INDEX_HASH_KEY);

        if (newIndexHash === oldIndexHash) {
            console.log('검색 인덱스 내용에 변경이 없어 KV 쓰기를 건너뜁니다.');
            return;
        }

        console.log(`검색 인덱스 해시 변경 감지. KV 업데이트 실행. (이전: ${oldIndexHash}, 신규: ${newIndexHash})`);
        await Promise.all([
            env.MABINOGI_METADATA_CACHE.put(SEARCH_INDEX_KEY, newIndexJson),
            env.MABINOGI_METADATA_CACHE.put(SEARCH_INDEX_HASH_KEY, newIndexHash)
        ]);

        // 검색 인덱스 API 경로 캐시 무효화
        await purgeCloudflareCache(env, [`https://api.mabidb.com/api/items/index`]);

        if (isFullRebuild) {
            console.log(`검색 인덱스 전체 재빌드 완료. 총 아이템 수: ${searchIndex.items.length}`);
        } else {
            console.log(`${newItemsCount}개의 신규 아이템을 검색 인덱스에 추가했습니다. 총 아이템 수: ${searchIndex.items.length}`);
        }

    } else {
        console.log('새로운 아이템이 없어 검색 인덱스를 업데이트하지 않습니다.');
    }
}

/**
 * 여러 아이템에 대해 D1 `items` 테이블 upsert 수행
 * mabinogi-auction-history의 getOrCreateItemIds와 동일한 패턴(사전 SELECT 없이 INSERT ON CONFLICT DO NOTHING 후 재조회) 재사용
 * @param {D1Database} db - D1 데이터베이스 인스턴스
 * @param {Array} items - item_name, item_display_name, auction_item_category 등을 포함한 원본 아이템 배열
 * @returns {Promise<Map<string, {itemId: number, isNew: boolean}>>} 대표 이름을 키로 하는 결과 Map
 */
async function upsertItemsToD1(db, items) {
    const nameToCategory = new Map();
    for (const item of items) {
        const representativeName = getRepresentativeItemName(item);
        if (!nameToCategory.has(representativeName)) {
            nameToCategory.set(representativeName, item.auction_item_category || '기타');
        }
    }

    const names = [...nameToCategory.keys()];
    if (names.length === 0) {
        return new Map();
    }

    // 1. INSERT OR IGNORE 배치 실행. db.batch()는 문장별로 개별 meta.changes를 반환하므로
    // (changes: 0인 문장의 last_row_id는 신뢰할 수 없어 신규 여부 판단에만 사용하고, id는 아래 2단계에서 재조회)
    const isNewMap = new Map();
    try {
        const insertStmts = names.map(name =>
            db.prepare('INSERT INTO items (name, category) VALUES (?, ?) ON CONFLICT(name) DO NOTHING')
              .bind(name, nameToCategory.get(name))
        );
        const insertResults = await db.batch(insertStmts);
        insertResults.forEach((res, i) => {
            isNewMap.set(names[i], res.meta.changes > 0);
        });
    } catch (e) {
        console.error(`D1 'INSERT ON CONFLICT' 실패`, { message: e.message, cause: e.cause });
        throw e;
    }

    // 2. 모든 대표 이름에 대한 id를 청크 단위로 재조회
    const finalMap = new Map();
    const CHUNK_SIZE = 90;
    for (let i = 0; i < names.length; i += CHUNK_SIZE) {
        const chunk = names.slice(i, i + CHUNK_SIZE);
        if (chunk.length === 0) continue;

        const placeholders = chunk.map(() => '?').join(',');
        const selectStmt = db.prepare(`SELECT id, name FROM items WHERE name IN (${placeholders})`).bind(...chunk);
        try {
            const { results: existingItems } = await selectStmt.all();
            for (const row of existingItems) {
                finalMap.set(row.name, { itemId: row.id, isNew: isNewMap.get(row.name) || false });
            }
        } catch (e) {
            console.error(`D1 'IN' 절 조회 실패 (ID 매핑)`, { message: e.message, cause: e.cause });
            throw e;
        }
    }
    return finalMap;
}

/**
 * POST /items/upsert 요청 핸들러
 * 원본 아이템 배열을 받아 대표 이름을 계산하고 D1 items 테이블에 upsert, 호출자가 필요로 하는 item_id/isNew를 응답
 * @param {Request} request
 * @param {object} env
 */
async function handleItemsUpsertRequest(request, env) {
    if (request.method !== 'POST') {
        return new Response('POST 요청만 허용', { status: 405 });
    }

    try {
        const body = await request.json();
        const items = Array.isArray(body) ? body : [body];
        if (items.length === 0) {
            return new Response('아이템 목록이 비어있음', { status: 400 });
        }

        const resultMap = await upsertItemsToD1(env.mabinogi_auction_db, items);

        const response = items.map(item => {
            const representativeName = getRepresentativeItemName(item);
            const result = resultMap.get(representativeName);
            return {
                representative_name: representativeName,
                category: item.auction_item_category || '기타',
                item_id: result?.itemId ?? null,
                isNew: result?.isNew ?? false,
            };
        });

        return new Response(JSON.stringify(response), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('아이템 upsert 처리 중 오류 발생:', error);
        return new Response('아이템 upsert 처리 중 오류 발생', { status: 500 });
    }
}

/**
 * 인챈트 메타데이터 처리 및 저장 ('상태 병합' 전략)
 */
async function handleEnchantUpdate(env, allItems) {
    const effectsToUpdate = await extractEnchantEffects(allItems);
    if (effectsToUpdate.length === 0) return;

    // INSERT OR IGNORE로 신규 효과를 먼저 삽입 시도
    const insertStmts = effectsToUpdate.map(effect => {
        return env.mabinogi_auction_db.prepare(
            'INSERT OR IGNORE INTO enchants (name, type, id, rank, template, min, max, variable, condition) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)'
        ).bind(effect.name, effect.type, effect.id, effect.rank, effect.desc, effect.min, effect.max, effect.condition);
    });
    await env.mabinogi_auction_db.batch(insertStmts);

    // 기존 효과의 min/max 값을 업데이트
    const updateStmts = effectsToUpdate.map(effect => {
        return env.mabinogi_auction_db.prepare(
            `UPDATE enchants SET 
                min = CASE WHEN min > ? THEN ? ELSE min END,
                max = CASE WHEN max < ? THEN ? ELSE max END,
                variable = CASE WHEN min != max THEN 1 ELSE 0 END 
             WHERE type = ? AND name = ? AND id = ?`
        ).bind(effect.min, effect.min, effect.max, effect.max, effect.type, effect.name, effect.id);
    });
    const batchResult = await env.mabinogi_auction_db.batch(updateStmts);

    // 변경 사항이 하나라도 있으면 캐시 갱신
    const hasChanges = batchResult.some(res => res.meta.changes > 0);
    if (hasChanges) {
        console.log('인챈트 효과 변경 감지. API 캐시를 갱신합니다.');
        try {
            await updateEnchantCombinedCache(env);
        } catch (e) { console.error('인챈트 통합 캐시 갱신 실패:', e); }
    }
}

/**
 * 아이템 배치에서 모든 인챈트 효과를 개별적으로 추출
 */
async function extractEnchantEffects(allItems) {
    const effects = [];
   for (const item of allItems) {
        if (!item || !item.item_option) continue;

        const enchantOptions = item.item_option.filter(opt => opt.option_type === '인챈트' && opt.option_value && opt.option_desc);
        for (const option of enchantOptions) {
            const { name, rank } = parseEnchantNameAndRank(option.option_value);
            const type = option.option_sub_type === '접두' ? 'prefix' : 'suffix';

            const parsedEffects = option.option_desc.split(',').map((text, index) => {
                const trimmedText = text.trim();
                const effect = parseEnchantEffect(trimmedText);
                return { ...effect, id: index + 1, condition: effect.condition || null }; // id 및 condition 추가
            });

            for (const effect of parsedEffects) {
                effects.push({ type, name, id: effect.id, rank: rank || 0, desc: effect.template, min: effect.min, max: effect.max, condition: effect.condition });
            }
        }
    }
    return effects;
}
/**
 * 세공, 세트 효과 등 카테고리별 메타데이터 처리
 *
 * 1. 아이템 배치에서 모든 고유 옵션을 추출합니다.
 * 2. D1의 UNIQUE 제약조건을 활용하여 `INSERT OR IGNORE`로 한 번에 삽입을 시도합니다.
 * 3. D1이 알아서 중복을 걸러내고 신규 옵션만 추가합니다.
 * 4. (신규) D1 `batch` 결과의 `meta.changes`를 확인하여 실제 변경이 있을 때만 KV 캐시를 갱신합니다.
 */
async function handleMetadataUpdate(env, allItems, config, logName) {
    const newOptionsByGroup = {}; // 이번 배치에서 발견된 옵션 후보들
    
    for (const item of allItems) {
        if (!item || !item.item_option) continue;

        const options = item.item_option.filter(opt => opt.option_type === config.optionType && opt.option_value);
        if (options.length === 0) continue;
        
        // ecostone은 parseOption이 객체를 반환하므로 별도 처리
        if (config.dbTable === 'ecostones') {
            for (const option of options) {
                const parsed = config.parseOption(option, item);
                if (!newOptionsByGroup[parsed.type]) newOptionsByGroup[parsed.type] = new Set();
                newOptionsByGroup[parsed.type].add(parsed.name);
            }
        } else {
            const category = item.auction_item_category;
            if (category) {
                if (!newOptionsByGroup[category]) newOptionsByGroup[category] = new Set();
                for (const option of options) newOptionsByGroup[category].add(config.parseOption(option, item));
            }
        }
    }

    const insertStmts = [];
    for (const groupKey in newOptionsByGroup) { // groupKey는 category 또는 type이 될 수 있음
        const uniqueOptions = Array.from(newOptionsByGroup[groupKey]);
        if (uniqueOptions.length === 0) continue;

        for (const opt of uniqueOptions) {
            // D1에 undefined, null 또는 객체 값을 삽입하려는 시도를 방지
            if (!opt || typeof opt === 'object') continue;

            // 설정 객체에서 그룹화에 사용할 컬럼 이름을 직접 가져옵니다.
            const groupColumn = config.groupColumn;
            insertStmts.push(
                env.mabinogi_auction_db.prepare(`INSERT OR IGNORE INTO ${config.dbTable} (${groupColumn}, name) VALUES (?, ?)`).bind(groupKey, opt)
            );
        }
    }

    if (insertStmts.length > 0) {
        console.log(`[${logName}] ${insertStmts.length}개의 옵션 후보에 대해 D1 삽입 시도.`);
        const batchResult = await env.mabinogi_auction_db.batch(insertStmts);

        // D1Result 배열의 모든 요소에서 changes 합산
        const totalChanges = batchResult.reduce((acc, res) => acc + (res.meta.changes || 0), 0);

        if (totalChanges > 0) {
            console.log(`[${logName}] D1에 ${totalChanges}개의 신규 옵션 저장됨. KV 캐시 갱신을 시작합니다.`);
            const urlsToPurge = new Set();

            // 1. KV에서 기존 캐시와 해시를 읽어옵니다.
            const [existingCache, oldHash] = await Promise.all([
                env.MABINOGI_METADATA_CACHE.get(config.kvKey, 'json') || {},
                env.MABINOGI_METADATA_CACHE.get(config.kvHashKey)
            ]);

            // 2. 메모리에서 캐시를 병합합니다.
            const updatedCache = { ...existingCache };
            for (const groupKey in newOptionsByGroup) {
                // 캐시 무효화를 위한 URL 생성
                if (config.dbTable === 'reforges') {
                    urlsToPurge.add(`https://api.mabidb.com/api/meta/reforges?category=${encodeURIComponent(groupKey)}`);
                } else if (config.dbTable === 'set_effects') {
                    urlsToPurge.add(`https://api.mabidb.com/api/meta/set-effects?category=${encodeURIComponent(groupKey)}`);
                } else if (config.dbTable === 'ecostones') {
                    urlsToPurge.add(`https://api.mabidb.com/api/meta/ecostones?category=${encodeURIComponent(groupKey)}`);
                }


                if (!updatedCache[groupKey]) updatedCache[groupKey] = [];
                const newOpts = Array.from(newOptionsByGroup[groupKey]);
                newOpts.forEach(opt => {
                    if (!updatedCache[groupKey].includes(opt)) {
                        updatedCache[groupKey].push(opt);
                    }
                });
                updatedCache[groupKey].sort(); // 일관성을 위해 정렬
            }
            
            // 3. 해시를 비교하여 변경되었을 때만 KV에 저장합니다.
            await updateKvCacheWithHash(env, config.kvKey, config.kvHashKey, updatedCache, oldHash);

            // 4. 관련된 URL의 CDN 캐시를 무효화합니다.
            if (urlsToPurge.size > 0) {
                await purgeCloudflareCache(env, Array.from(urlsToPurge));
            }
        }
    }
}
 
// --- 파싱 헬퍼 함수 ---

/** 인챈트 효과 텍스트 파싱 */
function parseEnchantEffect(effectText) {
  let result = { template: effectText, min: 0, max: 0, variable: false, condition: null };
  let effectPart = effectText;

  const conditionMatch = effectText.match(/(.*?때)\s+(.*)/);

  if (conditionMatch) {
    result.condition = conditionMatch[1].trim();
    effectPart = conditionMatch[2].trim();
  }
  if (/(증가|감소)$/.test(effectPart)) {
    const valueMatch = effectPart.match(/(\d+(?:\.\d+)?%?)\s*(증가|감소)$/);
    if (valueMatch) {
      const valueStr = valueMatch[1];
      const value = parseFloat(valueStr.replace('%', ''));
      const isPercent = valueStr.includes('%');
      const valuePlaceholder = '{value}' + (isPercent ? '%' : '');
      const escapedValueStr = valueStr.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
      result.template = effectPart.replace(new RegExp(`${escapedValueStr}\\s*${valueMatch[2]}$`), `${valuePlaceholder} ${valueMatch[2]}`);
      result.min = value;
      result.max = value;
    }
  }
  return result;
}

/** 인챈트 이름 및 랭크 파싱 */
function parseEnchantNameAndRank(enchantStr) {
  const rankPattern = /\(랭크 ([A-Za-z0-9]+)\)$/;
  const rankMatch = enchantStr.match(rankPattern);
  let rank = 0;
  let name = enchantStr;
  if (rankMatch) {
    rank = /^\d+$/.test(rankMatch[1]) ? parseInt(rankMatch[1]) : rankMatch[1];
    name = enchantStr.replace(rankPattern, '').trim();
  }
  return { name, rank };
}

// --- 캐시/집계 헬퍼들 ---

async function updateEnchantCombinedCache(env) {
    const metaKey = 'meta:enchants_combined';
    // 1. D1의 `enchant_effects` 테이블에서 모든 효과를 가져옵니다.
    const { results: allEffects } = await env.mabinogi_auction_db.prepare(
        'SELECT name, type, rank, template, min, max, variable, condition FROM enchants'
    ).all();

    // 2. 인챈트 이름과 타입(접두/접미)을 기준으로 효과들을 다시 그룹화합니다.
    const enchantsMap = new Map();
    for (const effect of allEffects) {
        const key = `${effect.type}:${effect.name}`;
        if (!enchantsMap.has(key)) {
            enchantsMap.set(key, { name: effect.name, type: effect.type, rank: effect.rank, effects: [] });
        }
        enchantsMap.get(key).effects.push({
            template: effect.template,
            min: effect.min, max: effect.max, variable: !!effect.variable, condition: effect.condition
        });
    }

    // 3. 최종 페이로드를 생성하여 KV에 저장합니다.
    const payload = {
        prefix: {},
        suffix: {}
    };
    enchantsMap.forEach(enchant => {
        if (enchant.type === 'prefix') {
            payload.prefix[enchant.name] = enchant;
        } else {
            payload.suffix[enchant.name] = enchant;
        }
    });

    await env.MABINOGI_METADATA_CACHE.put(metaKey, JSON.stringify(payload));

    // 인챈트 API 경로 캐시 무효화
    await purgeCloudflareCache(env, ['https://api.mabidb.com/api/meta/enchants']);
}

/**
 * 새로운 데이터의 해시를 계산하고, 기존 해시와 다를 경우에만 KV 캐시를 업데이트합니다.
 * @param {object} env - 워커 환경 변수
 * @param {string} kvKey - 데이터를 저장할 KV 키
 * @param {string} kvHashKey - 해시를 저장할 KV 키
 * @param {object} newData - 새로 저장할 데이터 객체
 * @param {string} oldHash - 이전에 저장된 해시 값
 */
async function updateKvCacheWithHash(env, kvKey, kvHashKey, newData, oldHash) {
    const newJson = JSON.stringify(newData);
    const newHash = await generateSha256(newJson);

    if (newHash !== oldHash) {
        console.log(`캐시 내용 변경 감지. KV 업데이트 실행. (Key: ${kvKey}, Hash: ${newHash})`);
        await Promise.all([
            env.MABINOGI_METADATA_CACHE.put(kvKey, newJson),
            env.MABINOGI_METADATA_CACHE.put(kvHashKey, newHash)
        ]);
    } else {
        console.log(`캐시 내용에 변경이 없어 KV 쓰기를 건너뜁니다. (Key: ${kvKey})`);
    }
}

/**
 * Cloudflare API를 사용하여 지정된 URL의 CDN 캐시를 무효화(Purge)합니다.
 * @param {object} env - 워커 환경 변수
 * @param {string[]} urls - 무효화할 URL 목록
 */
async function purgeCloudflareCache(env, urls) {
    if (!env.CF_ZONE_ID || !env.CF_PURGE_TOKEN) {
        console.warn('Cloudflare Zone ID 또는 Purge Token이 설정되지 않아 캐시 무효화를 건너뜁니다.');
        return;
    }
    if (urls.length === 0) return;

    try {
        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.CF_PURGE_TOKEN}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ files: urls }),
        });

        const result = await response.json();
        if (result.success) {
            console.log(`CDN 캐시 무효화 성공: ${urls.join(', ')}`);
        } else {
            console.error('CDN 캐시 무효화 실패:', result.errors);
        }
    } catch (error) {
        console.error('CDN 캐시 무효화 API 호출 중 오류 발생:', error);
    }
}

/**
 * 문자열의 SHA-256 해시를 생성하는 헬퍼 함수
 * @param {string} str - 해시할 문자열
 * @returns {Promise<string>} 16진수 해시 문자열
 */
async function generateSha256(str) {
    const textAsBuffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', textAsBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}