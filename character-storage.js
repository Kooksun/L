import { RTDB_BASE_URL } from './firebase-config.js';

// ItemAvgLevel 문자열을 숫자로 변환
function parseItemLevel(levelValue) {
    const levelStr = String(levelValue ?? '').replace(/,/g, '');
    const match = levelStr.match(/^\d+\.?\d*/);
    return match ? parseFloat(match[0]) : 0;
}

// 대표 캐릭터 선정 (ItemAvgLevel 기준 최고 레벨)
function selectRepresentativeCharacter(characters) {
    if (!characters || characters.length === 0) {
        return null;
    }

    const sorted = [...characters].sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel));
    return sorted[0];
}

// 표시 순서를 부여하며 정리
function normalizeCharactersForSave(characters) {
    const sortedByLevel = [...characters].sort((a, b) => parseItemLevel(b.ItemAvgLevel) - parseItemLevel(a.ItemAvgLevel));

    return sortedByLevel.map((char, index) => {
        const { ItemMaxLevel, ...rest } = char;
        return {
            ...rest,
            displayOrder: index
        };
    });
}

// 저장/조회 시 표시 순서가 없으면 레벨 기준으로 보정
function sortCharactersForDisplay(characters) {
    if (!Array.isArray(characters)) {
        return [];
    }

    const withOrder = characters.map((char, index) => ({
        ...char,
        _level: parseItemLevel(char.ItemAvgLevel),
        displayOrder: Number.isFinite(char.displayOrder) ? char.displayOrder : null,
        _fallbackIndex: index
    }));

    const hasMissingOrder = withOrder.some(char => char.displayOrder === null);

    if (hasMissingOrder) {
        withOrder.sort((a, b) => b._level - a._level || a._fallbackIndex - b._fallbackIndex);
        withOrder.forEach((char, idx) => {
            char.displayOrder = idx;
        });
    } else {
        withOrder.sort((a, b) => a.displayOrder - b.displayOrder);
    }

    return withOrder.map(({ _level, _fallbackIndex, ...rest }) => rest);
}

// 캐릭터 그룹 저장
async function saveCharacterGroup(characters) {
    if (!characters || characters.length === 0) {
        throw new Error('저장할 캐릭터가 없습니다.');
    }

    // 레벨 1000 미만 캐릭터 필터링
    const filteredCharacters = characters.filter(char => {
        const level = parseItemLevel(char.ItemAvgLevel);
        return level >= 1000;
    });

    if (filteredCharacters.length === 0) {
        throw new Error('레벨 1000 이상인 캐릭터가 없습니다.');
    }

    const representative = selectRepresentativeCharacter(filteredCharacters);
    const representativeName = representative.CharacterName;

    // 표시 순서가 포함된 정리된 데이터 (ItemMaxLevel 제거 포함)
    const cleanedCharacters = normalizeCharactersForSave(filteredCharacters);

    const groupData = {
        representativeName: representativeName,
        createdAt: new Date().toISOString(),
        characters: cleanedCharacters
    };

    try {
        // Firebase REST API를 사용하여 저장
        const response = await fetch(`${RTDB_BASE_URL}.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(groupData)
        });

        if (!response.ok) {
            throw new Error(`저장 실패: ${response.status}`);
        }

        const result = await response.json();
        console.log('캐릭터 그룹 저장 완료:', result);

        return {
            groupId: result.name,
            ...groupData
        };
    } catch (error) {
        console.error('캐릭터 그룹 저장 실패:', error);
        throw error;
    }
}

// 모든 캐릭터 그룹 조회
async function getAllCharacterGroups() {
    try {
        const response = await fetch(`${RTDB_BASE_URL}.json`);

        if (!response.ok) {
            throw new Error(`조회 실패: ${response.status}`);
        }

        const data = await response.json();

        if (!data) {
            return [];
        }

        // 객체를 배열로 변환
        const groups = Object.keys(data).map(key => ({
            groupId: key,
            ...data[key],
            characters: sortCharactersForDisplay(data[key].characters)
        }));

        // 최신순으로 정렬
        groups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        return groups;
    } catch (error) {
        console.error('캐릭터 그룹 조회 실패:', error);
        return [];
    }
}

// 특정 그룹 조회
async function getCharacterGroup(groupId) {
    try {
        const response = await fetch(`${RTDB_BASE_URL}/${groupId}.json`);

        if (!response.ok) {
            throw new Error(`조회 실패: ${response.status}`);
        }

        const data = await response.json();

        if (!data) {
            return null;
        }

        return {
            groupId: groupId,
            ...data,
            characters: sortCharactersForDisplay(data.characters)
        };
    } catch (error) {
        console.error('캐릭터 그룹 조회 실패:', error);
        return null;
    }
}

// 그룹 삭제
async function deleteCharacterGroup(groupId) {
    try {
        const response = await fetch(`${RTDB_BASE_URL}/${groupId}.json`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`삭제 실패: ${response.status}`);
        }

        console.log('캐릭터 그룹 삭제 완료:', groupId);
        return true;
    } catch (error) {
        console.error('캐릭터 그룹 삭제 실패:', error);
        throw error;
    }
}

// 캐릭터 순서 업데이트
async function updateCharacterOrder(groupId, characters) {
    try {
        const response = await fetch(`${RTDB_BASE_URL}/${groupId}.json`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ characters })
        });

        if (!response.ok) {
            throw new Error(`순서 저장 실패: ${response.status}`);
        }

        console.log('캐릭터 순서 업데이트 완료:', groupId);
        return true;
    } catch (error) {
        console.error('캐릭터 순서 업데이트 실패:', error);
        throw error;
    }
}

export {
    selectRepresentativeCharacter,
    saveCharacterGroup,
    getAllCharacterGroups,
    getCharacterGroup,
    deleteCharacterGroup,
    updateCharacterOrder
};
