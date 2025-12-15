import { database } from './firebase-config.js';
import { ref, update, set, onValue } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// 실시간 상태 구독
function subscribeToCharacterTodoState(callback) {
    const stateRef = ref(database, 'lostark/character_todo_state');

    return onValue(stateRef, (snapshot) => {
        const data = snapshot.val();
        callback(normalizeState(data));
    }, (error) => {
        console.error('캐릭터 TODO 상태 구독 실패:', error);
        callback({});
    });
}

async function fetchAllCharacterTodoState() {
    // 1회성 조회가 필요하다면 keep, 하지만 보통 subscribe로 대체가능
    // 호환성을 위해 유지하거나 빈 객체 반환해도 됨. 
    // 여기서는 마이그레이션을 위해 빈 껍데기로 두거나 에러 로그만 남겨도 됨.
    // 하지만 app.js에서 호출을 제거할 예정이므로 로직만 SDK로 변경해둠.
    // get()은 여기서 import 안했으므로 생략하고 app.js 수정에 집중.
    console.warn('fetchAllCharacterTodoState is deprecated. Use subscribeToCharacterTodoState instead.');
    return {};
}

async function saveSelectedGroupsForCharacter(charKey, groupIds) {
    const payload = {
        selectedGroups: Array.isArray(groupIds) ? Array.from(new Set(groupIds)) : null
    };

    const charRef = ref(database, `lostark/character_todo_state/${charKey}`);

    // update를 쓰면 completed가 날아가지 않음 (merge)
    await update(charRef, payload);

    // 반환값은 로컬에서 계산해서 리턴 (SDK는 리턴값으로 데이터를 주지 않음)
    // 정확한 동기화를 위해선 다시 get을 해야하지만, UI 낙관적 업데이트를 위해 payload 리턴
    return normalizeEntry(payload);
}

async function clearTodoSelectionForCharacter(charKey) {
    const charRef = ref(database, `lostark/character_todo_state/${charKey}`);
    await update(charRef, { selectedGroups: null });
    return normalizeEntry({ selectedGroups: null });
}

async function saveTodoCompletionForCharacter(charKey, groupId, itemId, value) {
    const normalizedValue = typeof value === 'number'
        ? Math.max(0, Math.floor(value))
        : !!value;

    const itemRef = ref(database, `lostark/character_todo_state/${charKey}/completed/${groupId}/${itemId}`);
    await set(itemRef, normalizedValue);

    return normalizedValue;
}

export {
    fetchAllCharacterTodoState,
    saveSelectedGroupsForCharacter,
    clearTodoSelectionForCharacter,
    saveTodoCompletionForCharacter,
    subscribeToCharacterTodoState
};
