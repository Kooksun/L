import { RTDB_BASE_URL } from './firebase-config.js';

// 대표 캐릭터 선정 (ItemAvgLevel 기준 최고 레벨)
function selectRepresentativeCharacter(characters) {
    if (!characters || characters.length === 0) {
        return null;
    }

    // ItemAvgLevel을 숫자로 변환하여 비교
    const sorted = [...characters].sort((a, b) => {
        const levelA = parseFloat(a.ItemAvgLevel) || 0;
        const levelB = parseFloat(b.ItemAvgLevel) || 0;
        return levelB - levelA; // 내림차순
    });

    return sorted[0];
}

// 캐릭터 그룹 저장
async function saveCharacterGroup(characters) {
    if (!characters || characters.length === 0) {
        throw new Error('저장할 캐릭터가 없습니다.');
    }

    const representative = selectRepresentativeCharacter(characters);
    const representativeName = representative.CharacterName;

    // ItemMaxLevel 제거 (사용자 요청)
    const cleanedCharacters = characters.map(char => {
        const { ItemMaxLevel, ...rest } = char;
        return rest;
    });

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
            ...data[key]
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
            ...data
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

export {
    selectRepresentativeCharacter,
    saveCharacterGroup,
    getAllCharacterGroups,
    getCharacterGroup,
    deleteCharacterGroup
};
