import { database } from './firebase-config.js';
import { ref, set, push, get, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
    try {
        const dbRef = ref(database, 'lostark/expedition_todo_catalog');
        const snapshot = await get(dbRef);
        return normalizeItems(snapshot.val());
    } catch (error) {
        console.error('원정대 TODO 조회 실패:', error);
        throw error;
    }
}

async function addExpeditionTodoItem(name, order = null, type = 'check', targetCount = null) {
    const payload = {
        name,
        createdAt: new Date().toISOString(),
        order: Number.isFinite(order) ? order : null,
        type: type === 'counter' ? 'counter' : 'check',
        targetCount: Number.isFinite(targetCount) ? Number(targetCount) : null
    };

    const dbRef = ref(database, 'lostark/expedition_todo_catalog');
    const newRef = push(dbRef);
    await set(newRef, payload);

    return {
        itemId: newRef.key,
        ...payload
    };
}

async function deleteExpeditionTodoItem(itemId) {
    const dbRef = ref(database, `lostark/expedition_todo_catalog/${itemId}`);
    await remove(dbRef);
}

async function updateExpeditionTodoOrders(orderEntries) {
    const updates = {};
    orderEntries.forEach(entry => {
        updates[`lostark/expedition_todo_catalog/${entry.itemId}/order`] = entry.order;
    });

    await update(ref(database), updates);
}

export {
    getExpeditionTodoItems,
    addExpeditionTodoItem,
    deleteExpeditionTodoItem,
    updateExpeditionTodoOrders
};
