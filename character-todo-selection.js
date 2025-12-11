import { CHARACTER_TODO_STATE_BASE_URL } from './firebase-config.js';

function normalizeEntry(entry = {}) {
    const selectedGroups = Array.isArray(entry.selectedGroups)
        ? Array.from(new Set(entry.selectedGroups))
        : null;

    const completed = entry.completed && typeof entry.completed === 'object'
        ? entry.completed
        : {};

    return { selectedGroups, completed };
}

function normalizeState(data) {
    if (!data) return {};
    return Object.keys(data).reduce((acc, charKey) => {
        acc[charKey] = normalizeEntry(data[charKey]);
        return acc;
    }, {});
}

async function fetchAllCharacterTodoState() {
    try {
        const response = await fetch(`${CHARACTER_TODO_STATE_BASE_URL}.json`);
        if (!response.ok) {
            throw new Error(`조회 실패: ${response.status}`);
        }
        const data = await response.json();
        return normalizeState(data);
    } catch (error) {
        console.error('캐릭터 TODO 상태 조회 실패:', error);
        return {};
    }
}

async function saveSelectedGroupsForCharacter(charKey, groupIds) {
    const payload = {
        selectedGroups: Array.isArray(groupIds) ? Array.from(new Set(groupIds)) : null
    };

    const response = await fetch(`${CHARACTER_TODO_STATE_BASE_URL}/${encodeURIComponent(charKey)}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`선택 저장 실패: ${response.status}`);
    }

    const saved = await response.json();
    return normalizeEntry(saved ?? payload);
}

async function clearTodoSelectionForCharacter(charKey) {
    const response = await fetch(`${CHARACTER_TODO_STATE_BASE_URL}/${encodeURIComponent(charKey)}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedGroups: null })
    });

    if (!response.ok) {
        throw new Error(`선택 초기화 실패: ${response.status}`);
    }

    const saved = await response.json();
    return normalizeEntry(saved);
}

async function saveTodoCompletionForCharacter(charKey, groupId, itemId, isCompleted) {
    const url = `${CHARACTER_TODO_STATE_BASE_URL}/${encodeURIComponent(charKey)}/completed/${encodeURIComponent(groupId)}/${encodeURIComponent(itemId)}.json`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(!!isCompleted)
    });

    if (!response.ok) {
        throw new Error(`완료 상태 저장 실패: ${response.status}`);
    }

    return !!isCompleted;
}

export {
    fetchAllCharacterTodoState,
    saveSelectedGroupsForCharacter,
    clearTodoSelectionForCharacter,
    saveTodoCompletionForCharacter
};
