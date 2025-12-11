// 로스트아크 API 클라이언트
const LOSTARK_API_BASE = "https://developer-lostark.game.onstove.com";
const TOKEN_STORAGE_KEY = "lostark_api_token";

// 로컬스토리지에서 토큰 가져오기
function getStoredToken() {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
}

// 로컬스토리지에 토큰 저장하기
function saveToken(token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
}

// 토큰 삭제
function clearToken() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
}

// API 호출 기본 함수
async function callLostArkAPI(endpoint, method = 'GET', body = null) {
    const token = getStoredToken();

    if (!token) {
        throw new Error('API 토큰이 설정되지 않았습니다. 토큰을 먼저 입력해주세요.');
    }

    const options = {
        method: method,
        headers: {
            'accept': 'application/json',
            'authorization': `bearer ${token}`
        }
    };

    if (body && method === 'POST') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    const url = `${LOSTARK_API_BASE}${endpoint}`;
    console.log(`API 호출: ${method} ${url}`);

    const response = await fetch(url, options);

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 호출 실패 (${response.status}): ${errorText}`);
    }

    return await response.json();
}

// 캐릭터의 형제 목록 조회
async function getCharacterSiblings(characterName) {
    const endpoint = `/characters/${encodeURIComponent(characterName)}/siblings`;
    return await callLostArkAPI(endpoint);
}

// 아이템 마켓 조회
async function getMarketItems(categoryCode) {
    const endpoint = '/markets/items';
    return await callLostArkAPI(endpoint, 'POST', { CategoryCode: categoryCode });
}

// 토큰 유효성 검사 (간단한 테스트 API 호출)
async function validateToken(token) {
    const tempToken = getStoredToken();
    saveToken(token);

    try {
        // 간단한 API 호출로 토큰 유효성 검사
        await getCharacterSiblings('테스트');
        return true;
    } catch (error) {
        // 토큰이 유효하지 않으면 원래 토큰으로 복구
        if (tempToken) {
            saveToken(tempToken);
        } else {
            clearToken();
        }
        return false;
    }
}

export {
    getStoredToken,
    saveToken,
    clearToken,
    callLostArkAPI,
    getCharacterSiblings,
    getMarketItems,
    validateToken
};
