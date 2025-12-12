import { EXPEDITION_TODO_BASE_URL } from './firebase-config.js';

function normalizeItems(data) {
    if (!data) return [];
    return Object.keys(data).map(key => ({
        itemId: key,
        name: data[key]?.name || '',
        createdAt: data[key]?.createdAt || null,
        order: Number.isFinite(data[key]?.order) ? data[key].order : null,
        type: data[key]?.type === 'counter' ? 'counter' : 'check',
        targetCount: Number.isFinite(data[key]?.targetCount) ? Number(data[key].targetCount) : null
    })).sort((a, b) => {
        const aHasOrder = Number.isFinite(a.order);
        const bHasOrder = Number.isFinite(b.order);
        if (aHasOrder && bHasOrder) return a.order - b.order;
        if (aHasOrder) return -1;
        if (bHasOrder) return 1;
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });
}

async function getExpeditionTodoItems() {
    const response = await fetch(`${EXPEDITION_TODO_BASE_URL}.json`);
    if (!response.ok) {
        throw new Error(`원정대 TODO 조회 실패: ${response.status}`);
    }
    const data = await response.json();
    return normalizeItems(data);
}

async function addExpeditionTodoItem(name, order = null, type = 'check', targetCount = null) {
    const payload = {
        name,
        createdAt: new Date().toISOString(),
        order: Number.isFinite(order) ? order : null,
        type: type === 'counter' ? 'counter' : 'check',
        targetCount: Number.isFinite(targetCount) ? Number(targetCount) : null
    };
    const response = await fetch(`${EXPEDITION_TODO_BASE_URL}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!response.ok) {
        throw new Error(`원정대 TODO 추가 실패: ${response.status}`);
    }
    const result = await response.json();
    return {
        itemId: result.name,
        ...payload
    };
}

async function deleteExpeditionTodoItem(itemId) {
    const response = await fetch(`${EXPEDITION_TODO_BASE_URL}/${encodeURIComponent(itemId)}.json`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        throw new Error(`원정대 TODO 삭제 실패: ${response.status}`);
    }
}

async function updateExpeditionTodoOrders(orderEntries) {
    const requests = orderEntries.map(entry => fetch(`${EXPEDITION_TODO_BASE_URL}/${encodeURIComponent(entry.itemId)}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: entry.order })
    }));

    const responses = await Promise.all(requests);
    const hasError = responses.some(res => !res.ok);
    if (hasError) {
        throw new Error('원정대 TODO 순서 저장 실패');
    }
}

export {
    getExpeditionTodoItems,
    addExpeditionTodoItem,
    deleteExpeditionTodoItem,
    updateExpeditionTodoOrders
};
