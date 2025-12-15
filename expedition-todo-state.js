import { database } from './firebase-config.js';
import { ref, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// 실시간 상태 구독
function subscribeToExpeditionTodoState(callback) {
    const stateRef = ref(database, 'lostark/expedition_todo_state');

    return onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        callback(normalizeState(data));
    }, (error) => {
        console.error('원정대 TODO 상태 구독 실패:', error);
        callback({});
    });
}

// deprecated but kept for signature compatibility if needed (will be removed from app.js)
async function fetchExpeditionTodoState() {
    console.warn('fetchExpeditionTodoState is deprecated. Use subscribeToExpeditionTodoState instead.');
    return {};
}

async function saveExpeditionTodoCompletion(groupId, itemId, value) {
    const normalizedValue = typeof value === 'number'
        ? Math.max(0, Math.floor(value))
        : !!value;

    const itemRef = ref(database, `lostark/expedition_todo_state/${groupId}/completed/${itemId}`);
    await set(itemRef, normalizedValue);

    return normalizedValue;
}

export { fetchExpeditionTodoState, saveExpeditionTodoCompletion, subscribeToExpeditionTodoState };
