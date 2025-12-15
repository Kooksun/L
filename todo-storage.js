import { database } from './firebase-config.js';
import { ref, set, push, get, remove, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

function normalizeTodoItems(itemsObj) {
    if (!itemsObj) return [];

    return Object.keys(itemsObj).map(key => ({
        itemId: key,
        name: itemsObj[key]?.name || '',
        createdAt: itemsObj[key]?.createdAt || null,
        order: Number.isFinite(itemsObj[key]?.order) ? itemsObj[key].order : null,
        type: itemsObj[key]?.type === 'counter' ? 'counter' : 'check',
        targetCount: Number.isFinite(itemsObj[key]?.targetCount) ? Number(itemsObj[key].targetCount) : null
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
        const dbRef = ref(database, 'lostark/todo_catalog');
        const snapshot = await get(dbRef);
        const data = snapshot.val();
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

    const dbRef = ref(database, 'lostark/todo_catalog');
    const newRef = push(dbRef);
    await set(newRef, payload);

    return {
        groupId: newRef.key,
        ...payload,
        items: []
    };
}

async function deleteTodoGroup(groupId) {
    const dbRef = ref(database, `lostark/todo_catalog/${groupId}`);
    await remove(dbRef);
}

async function addTodoItem(groupId, itemName, order = null, type = 'check', targetCount = null) {
    const payload = {
        name: itemName,
        createdAt: new Date().toISOString(),
        order: Number.isFinite(order) ? order : null,
        type: type === 'counter' ? 'counter' : 'check',
        targetCount: Number.isFinite(targetCount) ? Number(targetCount) : null
    };

    const dbRef = ref(database, `lostark/todo_catalog/${groupId}/items`);
    const newRef = push(dbRef);
    await set(newRef, payload);

    return {
        itemId: newRef.key,
        ...payload
    };
}

async function deleteTodoItem(groupId, itemId) {
    const dbRef = ref(database, `lostark/todo_catalog/${groupId}/items/${itemId}`);
    await remove(dbRef);
}

async function updateTodoGroupOrders(orderEntries) {
    const updates = {};
    orderEntries.forEach(entry => {
        updates[`lostark/todo_catalog/${entry.groupId}/order`] = entry.order;
    });

    // Using root reference to update multiple paths atomically is better
    // But here we can just update parallel or use 'update' on parent.
    // 'update' at root level is good.
    await update(ref(database), updates);
}

async function updateTodoItemOrders(groupId, orderEntries) {
    const updates = {};
    orderEntries.forEach(entry => {
        updates[`lostark/todo_catalog/${groupId}/items/${entry.itemId}/order`] = entry.order;
    });
    await update(ref(database), updates);
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
