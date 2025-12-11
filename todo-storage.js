import { TODO_BASE_URL } from './firebase-config.js';

function normalizeTodoItems(itemsObj) {
    if (!itemsObj) return [];

    return Object.keys(itemsObj).map(key => ({
        itemId: key,
        name: itemsObj[key]?.name || '',
        createdAt: itemsObj[key]?.createdAt || null,
        order: Number.isFinite(itemsObj[key]?.order) ? itemsObj[key].order : null
    })).sort((a, b) => {
        const aHasOrder = Number.isFinite(a.order);
        const bHasOrder = Number.isFinite(b.order);

        if (aHasOrder && bHasOrder) {
            return a.order - b.order;
        }
        if (aHasOrder) return -1;
        if (bHasOrder) return 1;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return aTime - bTime;
    });
}

function normalizeTodoGroups(data) {
    if (!data) return [];

    return Object.keys(data).map(key => ({
        groupId: key,
        name: data[key]?.name || '이름 없는 그룹',
        createdAt: data[key]?.createdAt || null,
        order: Number.isFinite(data[key]?.order) ? data[key].order : null,
        items: normalizeTodoItems(data[key]?.items)
    })).sort((a, b) => {
        const aHasOrder = Number.isFinite(a.order);
        const bHasOrder = Number.isFinite(b.order);

        if (aHasOrder && bHasOrder) {
            return a.order - b.order;
        }
        if (aHasOrder) return -1;
        if (bHasOrder) return 1;

        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
    });
}

async function getAllTodoGroups() {
    try {
        const response = await fetch(`${TODO_BASE_URL}.json`);
        if (!response.ok) {
            throw new Error(`조회 실패: ${response.status}`);
        }

        const data = await response.json();
        return normalizeTodoGroups(data);
    } catch (error) {
        console.error('TODO 목록 조회 실패:', error);
        throw error;
    }
}

async function createTodoGroup(name, order = null) {
    const payload = {
        name,
        createdAt: new Date().toISOString(),
        order: Number.isFinite(order) ? order : null,
        items: {}
    };

    const response = await fetch(`${TODO_BASE_URL}.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`그룹 생성 실패: ${response.status}`);
    }

    const result = await response.json();
    return {
        groupId: result.name,
        ...payload,
        items: []
    };
}

async function deleteTodoGroup(groupId) {
    const response = await fetch(`${TODO_BASE_URL}/${groupId}.json`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error(`그룹 삭제 실패: ${response.status}`);
    }
}

async function addTodoItem(groupId, itemName, order = null) {
    const payload = {
        name: itemName,
        createdAt: new Date().toISOString(),
        order: Number.isFinite(order) ? order : null
    };

    const response = await fetch(`${TODO_BASE_URL}/${groupId}/items.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        throw new Error(`항목 추가 실패: ${response.status}`);
    }

    const result = await response.json();
    return {
        itemId: result.name,
        ...payload
    };
}

async function deleteTodoItem(groupId, itemId) {
    const response = await fetch(`${TODO_BASE_URL}/${groupId}/items/${itemId}.json`, {
        method: 'DELETE'
    });

    if (!response.ok) {
        throw new Error(`항목 삭제 실패: ${response.status}`);
    }
}

async function updateTodoGroupOrders(orderEntries) {
    const requests = orderEntries.map(entry => fetch(`${TODO_BASE_URL}/${entry.groupId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: entry.order })
    }));

    const responses = await Promise.all(requests);
    const hasError = responses.some(res => !res.ok);
    if (hasError) {
        throw new Error('순서 저장 실패');
    }
}

async function updateTodoItemOrders(groupId, orderEntries) {
    const requests = orderEntries.map(entry => fetch(`${TODO_BASE_URL}/${groupId}/items/${entry.itemId}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: entry.order })
    }));

    const responses = await Promise.all(requests);
    const hasError = responses.some(res => !res.ok);
    if (hasError) {
        throw new Error('항목 순서 저장 실패');
    }
}

export {
    getAllTodoGroups,
    createTodoGroup,
    deleteTodoGroup,
    addTodoItem,
    deleteTodoItem,
    updateTodoGroupOrders,
    updateTodoItemOrders
};
