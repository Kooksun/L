import { EXPEDITION_TODO_STATE_BASE_URL } from './firebase-config.js';

function normalizeState(data) {
    if (!data) return {};
    return Object.keys(data).reduce((acc, groupId) => {
        const completed = data[groupId]?.completed;
        acc[groupId] = {
            completed: completed && typeof completed === 'object' ? completed : {}
        };
        return acc;
    }, {});
}

async function fetchExpeditionTodoState() {
    try {
        const response = await fetch(`${EXPEDITION_TODO_STATE_BASE_URL}.json`);
        if (!response.ok) throw new Error(`상태 조회 실패: ${response.status}`);
        const data = await response.json();
        return normalizeState(data);
    } catch (error) {
        console.error('원정대 TODO 상태 조회 실패:', error);
        return {};
    }
}

async function saveExpeditionTodoCompletion(groupId, itemId, isCompleted) {
    const url = `${EXPEDITION_TODO_STATE_BASE_URL}/${encodeURIComponent(groupId)}/completed/${encodeURIComponent(itemId)}.json`;
    const response = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(!!isCompleted)
    });
    if (!response.ok) {
        throw new Error(`원정대 TODO 완료 상태 저장 실패: ${response.status}`);
    }
    return !!isCompleted;
}

export { fetchExpeditionTodoState, saveExpeditionTodoCompletion };
