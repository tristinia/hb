// NEXON OPEN API - 마비노기 경매장 목록 조회 Worker

const NEXON_API_BASE_URL = "https://open.api.nexon.com/mabinogi/v1/auction";
// TODO: 실제 서비스할 프론트엔드 도메인으로 반드시 교체해주세요.
// 여러 도메인을 허용하려면 배열로 정의하고, 요청 Origin에 따라 동적으로 설정합니다.
const ALLOWED_ORIGINS = [
  'https://mabidb.com',
  'https://www.mabidb.com',
];

// 요청 Origin에 따라 동적으로 CORS 헤더를 생성하는 함수
function getCORSHeaders(requestOrigin) {
  const headers = {
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-nxopen-api-key, accept',
    'Access-Control-Max-Age': '86400',
  };

  // 요청 Origin이 허용된 목록에 있으면 해당 Origin을 Access-Control-Allow-Origin에 설정
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }
  return headers;
}

export default {
	async fetch(request, env, ctx) {
		// OPTIONS (preflight) 요청 처리
		const requestOrigin = request.headers.get('Origin');
		const corsHeaders = getCORSHeaders(requestOrigin);
		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: corsHeaders });
		}

		const url = new URL(request.url);
		const { pathname, searchParams } = url;

		try {
			let apiUrl;
			// API 경로에 따라 넥슨 API URL 생성
			if (pathname.endsWith('/searchByKeyword')) {
				apiUrl = buildKeywordSearchUrl(searchParams);
			} else if (pathname.endsWith('/searchByCategory')) {
				apiUrl = buildCategorySearchUrl(searchParams);
			} else {
				return jsonResponse({ error: "지원하지 않는 API 경로입니다." }, 400, corsHeaders);
			}

			// 넥슨 API로 프록시 요청 (env에서 API 키를 가져옴)
			return await proxyToNexonApi(apiUrl, env.NEXON_API_KEY, corsHeaders);

		} catch (error) {
			// 유효성 검사 등에서 발생한 오류 처리
			if (error instanceof ApiError) {
				return jsonResponse({ error: error.message }, error.statusCode, corsHeaders);
			}
			// 그 외 예기치 않은 오류 처리
			console.error(`Unexpected error: ${error.stack}`);
			return jsonResponse({ error: "요청 처리 중 오류가 발생했습니다." }, 500, corsHeaders);
		}
	},
};

/**
 * 키워드 검색을 위한 넥슨 API URL을 생성합니다.
 */
function buildKeywordSearchUrl(params) {
	const keyword = params.get('keyword');
	if (!keyword) {
		throw new ApiError("검색어를 입력해주세요.", 400);
	}

	const apiUrl = new URL(`${NEXON_API_BASE_URL}/keyword-search`);
	apiUrl.searchParams.set('keyword', keyword);

	if (params.has('cursor')) {
		apiUrl.searchParams.set('cursor', params.get('cursor'));
	}

	return apiUrl.toString();
}

/**
 * 카테고리 검색을 위한 넥슨 API URL을 생성합니다.
 */
function buildCategorySearchUrl(params) {
	const subCategory = params.get('subCategory');
	const itemName = params.get('itemName');

	if (!subCategory && !itemName) {
		throw new ApiError("카테고리(subCategory) 또는 아이템 이름(itemName) 중 하나 이상을 입력해주세요.", 400);
	}

	const apiUrl = new URL(`${NEXON_API_BASE_URL}/list`);
	const apiParams = apiUrl.searchParams;

	if (subCategory) apiParams.set('auction_item_category', subCategory);
	if (itemName) apiParams.set('item_name', itemName);
	if (params.has('cursor')) apiParams.set('cursor', params.get('cursor'));

	// 'filter_'로 시작하는 모든 추가 필터 파라미터를 처리합니다.
	for (const [key, value] of params.entries()) {
		if (key.startsWith('filter_') && value) {
			apiParams.set(key.replace('filter_', ''), value);
		}
	}

	return apiUrl.toString();
}

/**
 * 주어진 URL로 넥슨 API를 호출하고 응답을 반환합니다.
 */
async function proxyToNexonApi(apiUrl, apiKey, corsHeaders) {
	if (!apiKey) {
		console.error("NEXON_API_KEY secret is not set.");
		return jsonResponse({ error: "서버 설정 오류: API 키가 없습니다." }, 500, corsHeaders);
	}

	try {
		const response = await fetch(apiUrl, {
			headers: {
				'accept': 'application/json',
				'x-nxopen-api-key': apiKey,
                // 'Origin' 헤더는 Cloudflare Worker가 자동으로 전달하므로 명시적으로 추가할 필요 없음
			},
		});

		// 넥슨 API가 오류를 반환한 경우, 상태 코드와 메시지를 매핑하여 응답합니다.
		if (!response.ok) {
			const errorData = await response.json();
			const { message, statusCode } = mapNexonError(errorData, response.status);
			return jsonResponse({ error: message, code: errorData.error?.name }, statusCode, corsHeaders);
		}

		// 성공 응답을 그대로 클라이언트에게 전달합니다.
		const data = await response.json();
		return jsonResponse(data, 200, corsHeaders);

	} catch (error) {
		console.error(`API proxy error: ${error.stack}`);
		return jsonResponse({ error: "API 호출 중 오류가 발생했습니다." }, 502, corsHeaders); // 502 Bad Gateway
	}
}

/**
 * 넥슨 API 오류 코드를 더 이해하기 쉬운 메시지와 HTTP 상태 코드로 변환합니다.
 * (제공해주신 에러 코드 정보를 기반으로 작성되었습니다.)
 */
function mapNexonError(errorData, originalStatus) {
	const errorCode = errorData.error?.name;
	switch (errorCode) {
		case "OPENAPI00001": return { message: "서버 내부 오류가 발생했습니다.", statusCode: 500 };
		case "OPENAPI00002": return { message: "권한이 없는 요청입니다.", statusCode: 403 };
		case "OPENAPI00003": return { message: "유효하지 않은 식별자입니다.", statusCode: 400 };
		case "OPENAPI00004": return { message: "파라미터가 누락되었거나 유효하지 않습니다.", statusCode: 400 };
		case "OPENAPI00005": return { message: "유효하지 않은 API KEY 입니다.", statusCode: 401 }; // 401 Unauthorized가 더 적합
		case "OPENAPI00006": return { message: "유효하지 않은 게임 또는 API 경로입니다.", statusCode: 404 }; // 404 Not Found가 더 적합
		case "OPENAPI00007": return { message: "API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.", statusCode: 429 };
		case "OPENAPI00009": return { message: "데이터 준비 중입니다. 잠시 후 다시 시도해주세요.", statusCode: 503 }; // 503 Service Unavailable이 더 적합
		case "OPENAPI00010": return { message: "서비스 점검 중입니다.", statusCode: 503 }; // 503 Service Unavailable이 더 적합
		case "OPENAPI00011": return { message: "API 서비스에 접근할 수 없습니다.", statusCode: 503 };
		default: return { message: errorData.error?.message || "알 수 없는 API 오류가 발생했습니다.", statusCode: originalStatus };
	}
}

/**
 * JSON 응답을 생성하는 헬퍼 함수입니다.
 */
function jsonResponse(data, status, corsHeaders = {}) {
	const headers = {
		'Content-Type': 'application/json',
		...corsHeaders,
	};
	return new Response(JSON.stringify(data), { status, headers });
}

/**
 * API 관련 오류를 처리하기 위한 사용자 정의 오류 클래스입니다.
 */
class ApiError extends Error {
	constructor(message, statusCode) {
		super(message);
		this.statusCode = statusCode;
	}
}