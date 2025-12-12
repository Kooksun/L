import { getStoredToken, saveToken, clearToken, getCharacterSiblings } from './lostark-api.js';
import { saveCharacterGroup, getAllCharacterGroups, deleteCharacterGroup, updateCharacterOrder } from './character-storage.js';
import { getAllTodoGroups, createTodoGroup, deleteTodoGroup, addTodoItem, deleteTodoItem, updateTodoGroupOrders, updateTodoItemOrders } from './todo-storage.js';
import { getExpeditionTodoItems, addExpeditionTodoItem, deleteExpeditionTodoItem, updateExpeditionTodoOrders } from './expedition-todo-storage.js';
import { fetchAllCharacterTodoState, saveSelectedGroupsForCharacter, clearTodoSelectionForCharacter, saveTodoCompletionForCharacter } from './character-todo-selection.js';
import { fetchExpeditionTodoState, saveExpeditionTodoCompletion } from './expedition-todo-state.js';

const resultContainer = document.getElementById('result-container');
const dateDisplay = document.getElementById('date-display');
const loadingSpinner = document.getElementById('loading');
const tabsContainer = document.getElementById('tabs-container');

// 토큰 모달 관련
const tokenSettingsBtn = document.getElementById('token-settings-btn');
const tokenModal = document.getElementById('token-modal');
const tokenInput = document.getElementById('token-input');
const saveTokenBtn = document.getElementById('save-token-btn');
const cancelTokenBtn = document.getElementById('cancel-token-btn');
const clearTokenBtn = document.getElementById('clear-token-btn');
const tokenStatus = document.getElementById('token-status');
const toast = document.getElementById('toast');
const confirmModal = document.getElementById('confirm-modal');
const confirmMessage = document.getElementById('confirm-message');
const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
const confirmOkBtn = document.getElementById('confirm-ok-btn');

// TODO 관리 모달 관련
const todoManageBtn = document.getElementById('character-todo-manage-btn');
const todoModal = document.getElementById('todo-modal');
const todoModalCloseBtn = document.getElementById('todo-modal-close-btn');
const todoGroupInput = document.getElementById('todo-group-input');
const todoGroupAddBtn = document.getElementById('todo-group-add-btn');
const todoManagerList = document.getElementById('todo-manager-list');
const expeditionTodoManageBtn = document.getElementById('expedition-todo-manage-btn');
const expeditionTodoModal = document.getElementById('expedition-todo-modal');
const expeditionTodoModalCloseBtn = document.getElementById('expedition-todo-modal-close-btn');
const expeditionTodoInput = document.getElementById('expedition-todo-input');
const expeditionTodoTypeSelect = document.getElementById('expedition-todo-type');
const expeditionTodoTargetInput = document.getElementById('expedition-todo-target');
const expeditionTodoAddBtn = document.getElementById('expedition-todo-add-btn');
const expeditionTodoList = document.getElementById('expedition-todo-list');

// 캐릭터 TODO 선택 모달 관련
const characterTodoModal = document.getElementById('character-todo-modal');
const characterTodoModalTitle = document.getElementById('character-todo-modal-title');
const characterTodoList = document.getElementById('character-todo-list');
const characterTodoSaveBtn = document.getElementById('character-todo-save-btn');
const characterTodoCancelBtn = document.getElementById('character-todo-cancel-btn');
const characterTodoSelectAllBtn = document.getElementById('character-todo-select-all-btn');

// 그룹 추가 모달 관련
const addGroupBtn = document.getElementById('add-group-btn');
const addGroupModal = document.getElementById('add-group-modal');
const addGroupInput = document.getElementById('add-group-input');
const addGroupConfirmBtn = document.getElementById('add-group-confirm-btn');
const addGroupCancelBtn = document.getElementById('add-group-cancel-btn');

// 현재 선택된 그룹
let currentGroupId = null;
let allGroups = [];
let todoGroups = [];
let characterTodoState = {};
let expeditionTodoItems = [];
let expeditionTodoState = {};
let activeTodoSelectionTarget = null;
let cachedTestToken = null;
let testTokenChecked = false;

// 날짜 표시
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
dateDisplay.textContent = new Date().toLocaleDateString('ko-KR', options);

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    if (!getStoredToken()) {
        const testToken = await loadOptionalTestToken();
        if (testToken) {
            console.log('저장된 토큰이 없습니다. 테스트 토큰을 사용합니다.');
            saveToken(testToken);
        } else {
            console.log('테스트 토큰 파일이 없어 토큰 설정 모달을 엽니다.');
            openTokenModal();
        }
    }
    updateTokenStatus();

    // 저장된 TODO/그룹/캐릭터 TODO 상태/원정대 TODO 불러오기
    await Promise.all([
        loadTodoCatalog(),
        loadCharacterTodoState(),
        loadExpeditionTodoCatalog(),
        loadExpeditionTodoState()
    ]);
    await loadAllGroups();
});

// TODO 템플릿 불러오기
async function loadTodoCatalog() {
    try {
        todoGroups = await getAllTodoGroups();
        renderTodoManagerList();
        rerenderCurrentCardsWithTodos();
    } catch (error) {
        console.error('TODO 목록 불러오기 실패:', error);
        todoGroups = [];
        renderTodoManagerList();
        showToast('TODO 목록을 불러오지 못했습니다.', 'error');
    }
}

async function loadExpeditionTodoCatalog() {
    try {
        expeditionTodoItems = await getExpeditionTodoItems();
        renderExpeditionTodoList();
        rerenderCurrentCardsWithTodos();
    } catch (error) {
        console.error('원정대 TODO 목록 불러오기 실패:', error);
        expeditionTodoItems = [];
        renderExpeditionTodoList();
        showToast('원정대 TODO 목록을 불러오지 못했습니다.', 'error');
    }
}

async function loadCharacterTodoState() {
    try {
        characterTodoState = await fetchAllCharacterTodoState();
        rerenderCurrentCardsWithTodos();
    } catch (error) {
        console.error('캐릭터 TODO 상태 불러오기 실패:', error);
        characterTodoState = {};
        showToast('캐릭터 TODO 상태를 불러오지 못했습니다.', 'error');
    }
}

async function loadExpeditionTodoState() {
    try {
        expeditionTodoState = await fetchExpeditionTodoState();
        rerenderCurrentCardsWithTodos();
    } catch (error) {
        console.error('원정대 TODO 상태 불러오기 실패:', error);
        expeditionTodoState = {};
        showToast('원정대 TODO 상태를 불러오지 못했습니다.', 'error');
    }
}

// 저장된 모든 그룹 불러오기
async function loadAllGroups() {
    showLoading(true);
    try {
        allGroups = await getAllCharacterGroups();
        renderTabs();

        // 첫 번째 그룹 자동 선택
        const { mainGroups, miscGroups } = getGroupBuckets();
        if (mainGroups.length > 0) {
            selectGroup(mainGroups[0].groupId);
        } else if (miscGroups.length > 0) {
            selectGroup('misc');
        }
    } catch (error) {
        console.error('그룹 불러오기 실패:', error);
    } finally {
        showLoading(false);
    }
}

function renderTodoManagerList() {
    if (!todoManagerList) return;

    if (!todoGroups.length) {
        todoManagerList.innerHTML = '<div class="todo-manager-empty">등록된 TODO 그룹이 없습니다. 오른쪽 상단의 입력 칸으로 새 그룹을 추가하세요.</div>';
        return;
    }

    todoManagerList.innerHTML = todoGroups.map(group => `
        <div class="todo-manager-card" data-group-id="${group.groupId}">
            <div class="todo-manager-card-header">
                <div>
                    <div class="misc-group-name">${group.name}</div>
                    <div class="meta">${group.items?.length || 0}개 항목</div>
                </div>
                <div class="todo-manager-actions-inline">
                    <button class="secondary-btn xs todo-group-move-btn" data-direction="up" data-group-id="${group.groupId}">▲</button>
                    <button class="secondary-btn xs todo-group-move-btn" data-direction="down" data-group-id="${group.groupId}">▼</button>
                    <button class="danger-btn small todo-group-delete-btn" data-group-id="${group.groupId}">삭제</button>
                </div>
            </div>
            <ul class="todo-manager-item-list">
                ${(group.items || []).length ? group.items.map(item => {
                    const type = resolveTodoType(item);
                    const targetCount = resolveTargetCount(item);
                    const badgeLabel = type === 'counter'
                        ? (targetCount ? `카운트${targetCount}회` : '카운트∞')
                        : '체크';
                    return `
                    <li data-item-id="${item.itemId}" class="todo-manager-row">
                        <div class="todo-manager-item-meta">
                            <span class="todo-badge ${type}">${badgeLabel}</span>
                            <span class="todo-item-name">${item.name}</span>
                        </div>
                        <div class="todo-manager-actions-inline">
                            <button class="secondary-btn xs todo-item-move-btn" data-direction="up" data-group-id="${group.groupId}" data-item-id="${item.itemId}">▲</button>
                            <button class="secondary-btn xs todo-item-move-btn" data-direction="down" data-group-id="${group.groupId}" data-item-id="${item.itemId}">▼</button>
                            <button class="secondary-btn xs todo-item-delete-btn" data-group-id="${group.groupId}" data-item-id="${item.itemId}">삭제</button>
                        </div>
                    </li>
                `;
                }).join('') : '<li class="todo-manager-empty">항목이 없습니다.</li>'}
            </ul>
            <div class="todo-add-row">
                <input type="text" id="todo-item-input-${group.groupId}" data-group-id="${group.groupId}" placeholder="항목 추가 (예: 천상)">
                <select class="todo-item-type-select" id="todo-item-type-${group.groupId}" data-group-id="${group.groupId}">
                    <option value="check">체크</option>
                    <option value="counter">카운터</option>
                </select>
                <input type="number" class="todo-item-target-input" id="todo-item-target-${group.groupId}" data-group-id="${group.groupId}" placeholder="목표(선택)" min="1" step="1">
                <button class="primary-btn todo-item-add-btn" data-group-id="${group.groupId}">추가</button>
            </div>
        </div>
    `).join('');
}

function renderExpeditionTodoList() {
    if (!expeditionTodoList) return;

    if (!expeditionTodoItems.length) {
        expeditionTodoList.innerHTML = '<div class="todo-manager-empty">등록된 원정대 TODO가 없습니다. 위 입력란에서 추가하세요.</div>';
        return;
    }

    expeditionTodoList.innerHTML = `
        <div class="todo-manager-card">
            <ul class="todo-manager-item-list">
                ${expeditionTodoItems.map((item, idx) => {
                    const type = resolveTodoType(item);
                    const targetCount = resolveTargetCount(item);
                    const badgeLabel = type === 'counter'
                        ? (targetCount ? `카운트${targetCount}회` : '카운트∞')
                        : '체크';
                    return `
                    <li data-item-id="${item.itemId}" class="todo-manager-row">
                        <div class="todo-manager-item-meta">
                            <span class="todo-badge ${type}">${badgeLabel}</span>
                            <span class="todo-item-name">${item.name}</span>
                        </div>
                        <div class="todo-manager-actions-inline">
                            <button class="secondary-btn xs expedition-item-move-btn" data-direction="up" data-item-id="${item.itemId}">▲</button>
                            <button class="secondary-btn xs expedition-item-move-btn" data-direction="down" data-item-id="${item.itemId}">▼</button>
                            <button class="secondary-btn xs expedition-item-delete-btn" data-item-id="${item.itemId}">삭제</button>
                        </div>
                    </li>
                `;
                }).join('')}
            </ul>
        </div>
    `;
}

function getSelectedGroupIdsForCharacter(charKey) {
    const entry = characterTodoState[charKey];
    if (!entry) return null; // null => 모든 그룹 표시
    return Array.isArray(entry.selectedGroups) ? entry.selectedGroups : null;
}

function resolveTodoType(item = {}) {
    return item?.type === 'counter' ? 'counter' : 'check';
}

function resolveTargetCount(item = {}) {
    const parsed = Number(item?.targetCount);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getTodoValueFromState(state, groupId, itemId) {
    const container = groupId == null ? state : state?.[groupId];
    const value = container?.[itemId];
    if (typeof value === 'number') return value;
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
    return value ? 1 : 0;
}

function getTodoValueForCharacter(charKey, groupId, itemId) {
    const completed = characterTodoState[charKey]?.completed || {};
    return getTodoValueFromState(completed, groupId, itemId);
}

function getExpeditionTodoValue(groupId, itemId) {
    const completed = expeditionTodoState[groupId]?.completed || {};
    return getTodoValueFromState(completed, null, itemId);
}

function getTargetCountFromDataset(targetValue) {
    const parsed = Number(targetValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function renderCounterProgressHtml(targetCount, value) {
    const safeValue = Math.max(0, value || 0);
    if (!Number.isFinite(targetCount) || targetCount <= 0) {
        return `<span class="counter-count plain">${safeValue}회</span>`;
    }
    const filledCount = Math.min(safeValue, targetCount);
    return Array.from({ length: targetCount }, (_, idx) => `
        <span class="counter-segment ${idx < filledCount ? 'filled' : ''}"></span>
    `).join('');
}

function isTodoItemCompletable(type, targetCount) {
    if (type === 'check') return true;
    return Number.isFinite(targetCount) && targetCount > 0;
}

function isTodoItemCompleted(type, targetCount, value) {
    if (type === 'check') return Boolean(value);
    if (!Number.isFinite(targetCount)) return false;
    return value >= targetCount;
}

async function loadOptionalTestToken() {
    if (testTokenChecked) return cachedTestToken;
    testTokenChecked = true;
    try {
        const module = await import('./test-token.js');
        cachedTestToken = module.TEST_TOKEN || null;
    } catch (error) {
        console.info('test-token.js 파일을 찾지 못했습니다. 배포 환경으로 간주합니다.');
        cachedTestToken = null;
    }
    return cachedTestToken;
}

function setTodoCompletionInState(charKey, groupId, itemId, value) {
    const prevEntry = characterTodoState[charKey] || {};
    const nextCompleted = { ...(prevEntry.completed || {}) };
    nextCompleted[groupId] = { ...(nextCompleted[groupId] || {}) };
    nextCompleted[groupId][itemId] = value;

    characterTodoState = {
        ...characterTodoState,
        [charKey]: {
            selectedGroups: Array.isArray(prevEntry.selectedGroups) ? prevEntry.selectedGroups : null,
            completed: nextCompleted
        }
    };
}

function setExpeditionTodoCompletionInState(groupId, itemId, value) {
    const prevEntry = expeditionTodoState[groupId] || {};
    const nextCompleted = { ...(prevEntry.completed || {}) };
    nextCompleted[itemId] = value;

    expeditionTodoState = {
        ...expeditionTodoState,
        [groupId]: {
            completed: nextCompleted
        }
    };
}

function renderCharacterTodoSelectionList(charKey, characterName) {
    if (!characterTodoList) return;

    const selected = getSelectedGroupIdsForCharacter(charKey);
    const defaultAll = !Array.isArray(selected);
    const selectedSet = new Set(defaultAll ? todoGroups.map(group => group.groupId) : selected);

    if (!todoGroups.length) {
        characterTodoList.innerHTML = '<div class="todo-select-empty">등록된 TODO 그룹이 없습니다. 상단의 TODO 관리 버튼으로 먼저 추가하세요.</div>';
        characterTodoSaveBtn.disabled = true;
        characterTodoSelectAllBtn.disabled = true;
        return;
    }

    characterTodoSaveBtn.disabled = false;
    characterTodoSelectAllBtn.disabled = false;

    characterTodoList.innerHTML = todoGroups.map(group => {
        const safeId = `todo-select-${safeDomId(group.groupId, 'group')}`;
        const itemCount = group.items?.length || 0;
        return `
            <div class="todo-select-item">
                <input type="checkbox" id="${safeId}" data-group-id="${group.groupId}" ${selectedSet.has(group.groupId) ? 'checked' : ''}>
                <label for="${safeId}">${group.name}</label>
                <span class="meta">${itemCount}개 항목</span>
            </div>
        `;
    }).join('');

    if (characterTodoModalTitle) {
        characterTodoModalTitle.textContent = `${characterName} TODO 설정`;
    }
}

// 탭 렌더링
function renderTabs() {
    if (allGroups.length === 0) {
        tabsContainer.innerHTML = '<p class="no-tabs">저장된 캐릭터 그룹이 없습니다.</p>';
        return;
    }

    const { mainGroups, miscGroups } = getGroupBuckets();

    const tabsHtml = [
        ...mainGroups.map(group => `
            <div class="tab ${currentGroupId === group.groupId ? 'active' : ''}" 
                 data-group-id="${group.groupId}">
                <span class="tab-name">${group.representativeName}</span>
                <button class="tab-delete-btn" data-group-id="${group.groupId}" title="삭제">×</button>
            </div>
        `),
        ...(miscGroups.length ? [`
            <div class="tab ${currentGroupId === 'misc' ? 'active' : ''}" data-group-id="misc">
                <span class="tab-name">기타 (${miscGroups.length})</span>
            </div>
        `] : [])
    ].join('');

    tabsContainer.innerHTML = tabsHtml;

    // 이벤트 위임 방식으로 한 번만 등록
    setupTabEvents();
}

// 그룹 버킷
function getGroupBuckets() {
    const mainGroups = allGroups.filter(g => (g.characters?.length || 0) > 6);
    const miscGroups = allGroups.filter(g => (g.characters?.length || 0) <= 6);
    return { mainGroups, miscGroups };
}

function rerenderCurrentCardsWithTodos() {
    if (!currentGroupId) return;
    const { mainGroups, miscGroups } = getGroupBuckets();
    const group = mainGroups.find(g => g.groupId === currentGroupId);

    if (group) {
        displayCharacters(group);
    } else if (currentGroupId === 'misc') {
        displayMiscGroups(miscGroups);
    }
}

function attachTodoCheckboxHandlers(scope) {
    if (!scope) return;
    const blocks = scope.querySelectorAll('.todo-group-block');
    blocks.forEach(block => {
        const checkboxes = block.querySelectorAll('.todo-checkbox');
        checkboxes.forEach(cb => cb.addEventListener('change', () => updateTodoGroupMeta(block)));
        updateTodoGroupMeta(block);
    });
}

function updateTodoGroupMeta(block) {
    if (!block) return;
    const meta = block.querySelector('.todo-group-title .meta');
    if (!meta) return;

    const items = block.querySelectorAll('.todo-item-row');
    let total = 0;
    let completed = 0;

    items.forEach(item => {
        const type = item.dataset.type === 'counter' ? 'counter' : 'check';
        const targetRaw = Number(item.dataset.target);
        const targetCount = Number.isFinite(targetRaw) && targetRaw > 0 ? targetRaw : null;
        let value = Number(item.dataset.value);

        if (type === 'check') {
            const checkbox = item.querySelector('.todo-checkbox');
            value = checkbox?.checked ? 1 : 0;
            item.dataset.value = value;
        } else if (!Number.isFinite(value) || value < 0) {
            value = 0;
            item.dataset.value = 0;
        }

        const completable = isTodoItemCompletable(type, targetCount);
        const isCompleted = isTodoItemCompleted(type, targetCount, value);
        item.dataset.completable = completable ? 'true' : 'false';
        item.dataset.completed = isCompleted ? 'true' : 'false';

        if (type === 'counter') {
            syncCounterRowUI(item, value);
        }

        if (completable) {
            total += 1;
            if (isCompleted) completed += 1;
        }
    });

    meta.dataset.total = total;
    meta.dataset.checked = completed;
    meta.textContent = `${completed}/${total}개`;
}

function parseCounterValue(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return Math.floor(parsed);
}

function syncCounterRowUI(row, nextValue) {
    if (!row) return;
    const checkbox = row.querySelector('.todo-checkbox');
    const progress = row.querySelector('.counter-progress');
    const type = row.dataset.type === 'counter' ? 'counter' : 'check';
    const targetCount = getTargetCountFromDataset(row.dataset.target);
    const value = parseCounterValue(nextValue);
    const isCompleted = isTodoItemCompleted(type, targetCount, value);
    const shouldCheck = type === 'counter' && !Number.isFinite(targetCount)
        ? value > 0
        : isCompleted;

    row.dataset.value = value;
    row.dataset.completed = isCompleted ? 'true' : 'false';

    if (checkbox) {
        checkbox.checked = shouldCheck;
    }

    if (progress) {
        progress.innerHTML = renderCounterProgressHtml(targetCount, value);
    }
}

async function persistCounterValue(sourceEl, nextValue) {
    const row = sourceEl?.classList?.contains?.('todo-item-row') ? sourceEl : sourceEl?.closest?.('.todo-item-row');
    if (!row) return;
    const dataSource = row.dataset && Object.keys(row.dataset).length ? row.dataset : (sourceEl?.dataset || {});
    const targetValue = parseCounterValue(nextValue);
    const { expedition, characterKey, groupId, itemId } = dataSource;
    if (!groupId || !itemId) {
        console.warn('[counter-persist-missing-ids]', { expedition, characterKey, groupId, itemId, dataSource, row });
        return;
    }
    const block = row.closest('.todo-group-block');

    if (expedition === 'true') {
        const previousValue = getExpeditionTodoValue(groupId, itemId);
        try {
            await saveExpeditionTodoCompletion(groupId, itemId, targetValue);
            setExpeditionTodoCompletionInState(groupId, itemId, targetValue);
            syncCounterRowUI(row, targetValue);
            updateTodoGroupMeta(block);
        } catch (error) {
            console.error('원정대 TODO 상태 저장 실패:', error);
            syncCounterRowUI(row, previousValue);
            updateTodoGroupMeta(block);
            showToast('원정대 TODO 상태 저장에 실패했습니다.', 'error');
        }
        return;
    }

    if (!characterKey) return;

    const previousValue = getTodoValueForCharacter(characterKey, groupId, itemId);
    try {
        await saveTodoCompletionForCharacter(characterKey, groupId, itemId, targetValue);
        setTodoCompletionInState(characterKey, groupId, itemId, targetValue);
        syncCounterRowUI(row, targetValue);
        updateTodoGroupMeta(block);
    } catch (error) {
        console.error('TODO 완료 상태 저장 실패:', error);
        syncCounterRowUI(row, previousValue);
        updateTodoGroupMeta(block);
        showToast('완료 상태 저장에 실패했습니다.', 'error');
    }
}

async function moveTodoGroup(groupId, direction) {
    const index = todoGroups.findIndex(g => g.groupId === groupId);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= todoGroups.length) return;

    const clone = [...todoGroups];
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    const prevState = todoGroups;
    todoGroups = clone;
    renderTodoManagerList();
    rerenderCurrentCardsWithTodos();

    try {
        await persistTodoGroupOrders();
        showToast('그룹 순서를 저장했습니다.');
    } catch (error) {
        console.error('TODO 그룹 순서 저장 실패:', error);
        todoGroups = prevState;
        renderTodoManagerList();
        rerenderCurrentCardsWithTodos();
        showToast('순서 저장에 실패했습니다.', 'error');
    }
}

async function persistTodoGroupOrders() {
    const orderEntries = todoGroups.map((group, idx) => ({
        groupId: group.groupId,
        order: idx
    }));
    await updateTodoGroupOrders(orderEntries);
}

async function moveTodoItem(groupId, itemId, direction) {
    const group = todoGroups.find(g => g.groupId === groupId);
    if (!group) return;

    const items = group.items || [];
    const index = items.findIndex(item => item.itemId === itemId);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= items.length) return;

    const newItems = [...items];
    [newItems[index], newItems[swapIndex]] = [newItems[swapIndex], newItems[index]];

    const prevItems = group.items;
    group.items = newItems;
    renderTodoManagerList();
    rerenderCurrentCardsWithTodos();

    try {
        await persistTodoItemOrders(groupId, newItems);
        showToast('항목 순서를 저장했습니다.');
    } catch (error) {
        console.error('TODO 항목 순서 저장 실패:', error);
        group.items = prevItems;
        renderTodoManagerList();
        rerenderCurrentCardsWithTodos();
        showToast('항목 순서 저장에 실패했습니다.', 'error');
    }
}

async function persistTodoItemOrders(groupId, items) {
    const orderEntries = (items || []).map((item, idx) => ({
        itemId: item.itemId,
        order: idx
    }));
    await updateTodoItemOrders(groupId, orderEntries);
}

async function moveExpeditionTodoItem(itemId, direction) {
    const index = expeditionTodoItems.findIndex(item => item.itemId === itemId);
    if (index === -1) return;

    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= expeditionTodoItems.length) return;

    const clone = [...expeditionTodoItems];
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
    const prevState = expeditionTodoItems;
    expeditionTodoItems = clone;
    renderExpeditionTodoList();
    rerenderCurrentCardsWithTodos();

    try {
        const orderEntries = expeditionTodoItems.map((item, idx) => ({
            itemId: item.itemId,
            order: idx
        }));
        await updateExpeditionTodoOrders(orderEntries);
        showToast('원정대 TODO 순서를 저장했습니다.');
    } catch (error) {
        console.error('원정대 TODO 순서 저장 실패:', error);
        expeditionTodoItems = prevState;
        renderExpeditionTodoList();
        rerenderCurrentCardsWithTodos();
        showToast('원정대 TODO 순서 저장에 실패했습니다.', 'error');
    }
}

// 탭 이벤트 설정 (한 번만 호출)
let tabEventsSetup = false;
function setupTabEvents() {
    if (tabEventsSetup) return;
    tabEventsSetup = true;

    let longPressTimer = null;
    let longPressTriggered = false;
    const LONG_PRESS_MS = 700;

    const clearLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };

    const startLongPress = (tab) => {
        if (!tab || tab.dataset.groupId === 'misc') return;
        longPressTriggered = false;
        clearLongPress();
        longPressTimer = setTimeout(() => {
            longPressTriggered = true;
            refreshGroupData(tab.dataset.groupId);
        }, LONG_PRESS_MS);
    };

    // 이벤트 위임: tabsContainer에 한 번만 등록
    tabsContainer.addEventListener('click', async (e) => {
        if (longPressTriggered) {
            longPressTriggered = false;
            return;
        }

        // 삭제 버튼 클릭
        if (e.target.classList.contains('tab-delete-btn')) {
            e.preventDefault();
            e.stopPropagation();

            const groupId = e.target.dataset.groupId;
            await handleDeleteGroup(groupId);
            return;
        }

        // 탭 클릭 (삭제 버튼이 아닌 경우)
        const tab = e.target.closest('.tab');
        if (tab && !e.target.classList.contains('tab-delete-btn')) {
            const groupId = tab.dataset.groupId;
            selectGroup(groupId);
        }
    });

    tabsContainer.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('tab-delete-btn')) return;
        const tab = e.target.closest('.tab');
        startLongPress(tab);
    });

    tabsContainer.addEventListener('mouseup', clearLongPress);
    tabsContainer.addEventListener('mouseleave', clearLongPress);
    tabsContainer.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('tab-delete-btn')) return;
        const tab = e.target.closest('.tab');
        startLongPress(tab);
    }, { passive: true });
    tabsContainer.addEventListener('touchend', clearLongPress);
    tabsContainer.addEventListener('touchcancel', clearLongPress);
}

// 그룹 선택
function selectGroup(groupId) {
    const { mainGroups, miscGroups } = getGroupBuckets();
    const group = mainGroups.find(g => g.groupId === groupId);
    const isMiscGroup = miscGroups.some(g => g.groupId === groupId) || groupId === 'misc';

    currentGroupId = group ? groupId : (isMiscGroup ? 'misc' : groupId);

    // 활성 탭 CSS만 업데이트 (renderTabs 호출하지 않음)
    document.querySelectorAll('.tab').forEach(tab => {
        if (tab.dataset.groupId === currentGroupId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });

    if (group) {
        displayCharacters(group);
    } else if (isMiscGroup) {
        displayMiscGroups(miscGroups);
    }
}

// 삭제 확인 모달
function showConfirmModal(message) {
    confirmMessage.textContent = message;
    confirmModal.style.display = 'flex';

    return new Promise((resolve) => {
        const cleanup = (result) => {
            confirmModal.style.display = 'none';
            confirmCancelBtn.removeEventListener('click', onCancel);
            confirmOkBtn.removeEventListener('click', onConfirm);
            confirmModal.removeEventListener('click', onBackdrop);
            resolve(result);
        };

        const onCancel = () => cleanup(false);
        const onConfirm = () => cleanup(true);
        const onBackdrop = (e) => {
            if (e.target === confirmModal) {
                cleanup(false);
            }
        };

        confirmCancelBtn.addEventListener('click', onCancel);
        confirmOkBtn.addEventListener('click', onConfirm);
        confirmModal.addEventListener('click', onBackdrop);
    });
}

// 토스트 표시
let toastTimeout = null;
function showToast(message, type = 'success') {
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('show', 'success', 'error');
    toast.classList.add(type === 'error' ? 'error' : 'success');

    // 리플로우를 위해 강제 측정
    void toast.offsetWidth;

    toast.classList.add('show');

    if (toastTimeout) clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2000);
}

function safeDomId(value, fallback = 'item') {
    const cleaned = String(value ?? '').replace(/[^a-zA-Z0-9_-]/g, '');
    return cleaned || fallback;
}

// 그룹 삭제
async function handleDeleteGroup(groupId) {
    const group = allGroups.find(g => g.groupId === groupId);
    if (!group) return;

    const confirmed = await showConfirmModal(`"${group.representativeName}" 그룹을 삭제하시겠습니까?`);
    if (!confirmed) {
        return;
    }

    try {
        await deleteCharacterGroup(groupId);

        // 로컬 배열에서 제거
        allGroups = allGroups.filter(g => g.groupId !== groupId);

        renderTabs();
        const { mainGroups, miscGroups } = getGroupBuckets();

        // 삭제된 그룹이 현재 선택된 그룹이면 다른 그룹 선택
        if (currentGroupId === groupId) {
            currentGroupId = null;
            resultContainer.innerHTML = '';

            if (mainGroups.length > 0) {
                selectGroup(mainGroups[0].groupId);
            } else if (miscGroups.length > 0) {
                selectGroup('misc');
            }
        } else if (currentGroupId === 'misc') {
            if (miscGroups.length > 0) {
                selectGroup('misc');
            } else if (mainGroups.length > 0) {
                selectGroup(mainGroups[0].groupId);
            } else {
                resultContainer.innerHTML = '';
            }
        }

        showToast('그룹이 삭제되었습니다.', 'success');
    } catch (error) {
        showToast('그룹 삭제에 실패했습니다.', 'error');
    }
}

// 캐릭터 표시
function displayCharacters(group) {
    const characters = getCharactersInDisplayOrder(group.characters || []);

    const html = `
        <div class="character-list">
            ${buildExpeditionTodoBlock(group.groupId)}
            <div class="characters-grid" data-group-id="${group.groupId}">
                ${buildCharacterCards(characters, { enableDrag: true })}
            </div>
        </div>
    `;

    resultContainer.innerHTML = html;
    setupDragAndDrop(group.groupId);
    attachTodoCheckboxHandlers(resultContainer);
}

// 기타 그룹 표시 (6개 이하 그룹 모음)
function displayMiscGroups(miscGroups) {
    if (!miscGroups || miscGroups.length === 0) {
        resultContainer.innerHTML = '<p class="no-results">표시할 기타 그룹이 없습니다.</p>';
        return;
    }

    const html = `
        <div class="misc-groups">
            ${miscGroups.map(group => `
                <div class="misc-group-card">
                    <div class="misc-group-header">
                        <div>
                            <div class="misc-group-name">${group.representativeName}</div>
                            <div class="misc-group-meta">${group.characters?.length || 0} 캐릭터</div>
                        </div>
                        <div class="todo-manager-actions-inline">
                            <button class="secondary-btn xs misc-refresh-btn" data-group-id="${group.groupId}">갱신</button>
                            <button class="danger-btn small group-delete-btn" data-group-id="${group.groupId}">삭제</button>
                        </div>
                    </div>
                    ${buildExpeditionTodoBlock(group.groupId)}
                    <div class="characters-grid">
                        ${buildCharacterCards(getCharactersInDisplayOrder(group.characters || []))}
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    resultContainer.innerHTML = html;

    resultContainer.querySelectorAll('.group-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await handleDeleteGroup(btn.dataset.groupId);
        });
    });

    resultContainer.querySelectorAll('.misc-refresh-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await refreshGroupData(btn.dataset.groupId);
        });
    });
    attachTodoCheckboxHandlers(resultContainer);
}

function getTodoGroupsForCard(char) {
    if (todoGroups.length > 0) {
        const availableGroups = todoGroups.map(group => ({
            groupId: group.groupId || safeDomId(group.name, 'group'),
            name: group.name || '이름 없는 그룹',
            items: group.items || []
        }));

        const selected = getSelectedGroupIdsForCharacter(getCharacterKey(char));
        const hasCustomSelection = Array.isArray(selected);

        if (hasCustomSelection) {
            const selectedSet = new Set(selected);
            return availableGroups.filter(group => selectedSet.has(group.groupId));
        }

        return availableGroups;
    }

    const dummyItems = getDummyTodosForCharacter(char);
    return [{
        groupId: 'default',
        name: '기본 TODO',
        items: dummyItems.map((name, index) => ({
            itemId: `dummy-${index}`,
            name
        }))
    }];
}

function buildExpeditionTodoBlock(groupId) {
    const items = expeditionTodoItems || [];
    if (!items.length) {
        return `
            <div class="todo-group-block">
                <div class="todo-group-title">
                    <span>원정대 TODO</span>
                    <span class="meta" data-total="0" data-checked="0">0/0개</span>
                </div>
                <div class="todo-empty">등록된 원정대 TODO가 없습니다.</div>
            </div>
        `;
    }

    const completableCount = items.filter(item => isTodoItemCompletable(resolveTodoType(item), resolveTargetCount(item))).length;

    const listHtml = items.map((item, index) => {
        const itemId = item.itemId ?? index;
        const type = resolveTodoType(item);
        const targetCount = resolveTargetCount(item);
        const value = getExpeditionTodoValue(groupId, itemId);
        const isCompletable = isTodoItemCompletable(type, targetCount);
        const isCompleted = isTodoItemCompleted(type, targetCount, value);
        const itemIdSafe = safeDomId(itemId, `item-${index}`);

        if (type === 'counter') {
            const checkboxId = `expedition-${safeDomId(groupId, 'group')}-${itemIdSafe}`;
            return `
                <li class="todo-item-row counter-row" data-type="counter" data-target="${targetCount ?? ''}" data-value="${value}" data-completable="${isCompletable}" data-completed="${isCompleted}" data-expedition="true" data-group-id="${groupId}" data-item-id="${itemId}">
                    <div class="todo-check">
                        <input type="checkbox" id="${checkboxId}" class="todo-checkbox" data-expedition="true" data-group-id="${groupId}" data-item-id="${itemId}" ${isCompleted ? 'checked' : ''}>
                        <label for="${checkboxId}" class="todo-text">${item.name || ''}</label>
                    </div>
                    <div class="counter-progress ${targetCount ? '' : 'unbounded'}" data-target="${targetCount ?? ''}">
                        ${renderCounterProgressHtml(targetCount, value)}
                    </div>
                </li>
            `;
        }

        const checkboxId = `expedition-${safeDomId(groupId, 'group')}-${itemIdSafe}`;
        return `
            <li class="todo-item-row" data-type="check" data-target="" data-value="${value}" data-completable="true" data-completed="${isCompleted}" data-expedition="true" data-group-id="${groupId}" data-item-id="${itemId}">
                <input type="checkbox" id="${checkboxId}" class="todo-checkbox" data-expedition="true" data-group-id="${groupId}" data-item-id="${itemId}" ${isCompleted ? 'checked' : ''}>
                <label for="${checkboxId}" class="todo-text">${item.name || ''}</label>
            </li>
        `;
    }).join('');

    return `
        <div class="todo-group-block expedition-block" data-group-id="${groupId}">
            <div class="todo-group-title">
                <span>원정대 TODO</span>
                <span class="meta" data-total="${completableCount}" data-checked="0">0/${completableCount}개</span>
            </div>
            <ul class="todo-list expedition-inline-list">
                ${listHtml}
            </ul>
        </div>
    `;
}

// 캐릭터 카드 HTML 생성
function buildCharacterCards(characters, options = {}) {
    const { enableDrag = false } = options;

    return characters.map(char => {
        const charKey = getCharacterKey(char);
        const todosForCard = getTodoGroupsForCard(char);
        const todoHtml = todosForCard.length ? todosForCard.map(group => {
            const groupIdSafe = safeDomId(group.groupId || group.name, 'group');
            const items = (group.items || []).length
                ? group.items.map((item, index) => {
                    const itemId = item.itemId ?? index;
                    const type = resolveTodoType(item);
                    const targetCount = resolveTargetCount(item);
                    const value = getTodoValueForCharacter(charKey, group.groupId, itemId);
                    const isCompletable = isTodoItemCompletable(type, targetCount);
                    const isCompleted = isTodoItemCompleted(type, targetCount, value);
                    const itemIdSafe = safeDomId(itemId, `item-${index}`);
                    const sharedAttrs = `data-group-id="${group.groupId}" data-item-id="${itemId}" data-character-key="${charKey}"`;

                    if (type === 'counter') {
                        const checkboxId = `todo-${safeDomId(charKey, 'char')}-${groupIdSafe}-${itemIdSafe}`;
                        return `
                            <li class="todo-item-row counter-row" data-type="counter" data-target="${targetCount ?? ''}" data-value="${value}" data-completable="${isCompletable}" data-completed="${isCompleted}" ${sharedAttrs}>
                                <div class="todo-check">
                                    <input type="checkbox" id="${checkboxId}" class="todo-checkbox" ${sharedAttrs} ${isCompleted ? 'checked' : ''}>
                                    <label for="${checkboxId}" class="todo-text">${item.name || ''}</label>
                                </div>
                                <div class="counter-progress ${targetCount ? '' : 'unbounded'}" data-target="${targetCount ?? ''}">
                                    ${renderCounterProgressHtml(targetCount, value)}
                                </div>
                            </li>
                        `;
                    }

                    const checkboxId = `todo-${safeDomId(charKey, 'char')}-${groupIdSafe}-${itemIdSafe}`;
                    return `
                            <li class="todo-item-row" data-type="check" data-target="" data-value="${value}" data-completable="true" data-completed="${isCompleted}" ${sharedAttrs}>
                                <input type="checkbox" id="${checkboxId}" class="todo-checkbox" ${sharedAttrs} ${isCompleted ? 'checked' : ''}>
                                <label for="${checkboxId}" class="todo-text">${item.name || ''}</label>
                            </li>
                        `;
                }).join('')
                : '<li class="todo-empty">등록된 항목이 없습니다.</li>';

            const totalCount = (group.items || []).filter(item => isTodoItemCompletable(resolveTodoType(item), resolveTargetCount(item))).length;

            return `
                    <div class="todo-group-block">
                        <div class="todo-group-title">
                            <span>${group.name}</span>
                            <span class="meta" data-group-id="${groupIdSafe}" data-total="${totalCount}" data-checked="0">0/${totalCount}개</span>
                        </div>
                        <ul class="todo-list">
                            ${items}
                        </ul>
                    </div>
                `;
        }).join('') : '<div class="todo-empty">선택된 TODO 그룹이 없습니다. ⚙️ 버튼으로 설정하세요.</div>';

        return `
        <div class="character-card ${enableDrag ? 'draggable-card' : ''}" 
             data-character-key="${getCharacterKey(char)}"
             data-display-order="${char.displayOrder ?? 0}">
            <div class="character-header" data-tooltip="서버: ${char.ServerName} · 직업: ${char.CharacterClassName}">
                <div class="character-title drag-handle" ${enableDrag ? 'draggable="true"' : ''}>
                    <span class="character-name">${char.CharacterName}</span>
                    <span class="character-level-pill">Lv. ${char.ItemAvgLevel}</span>
                </div>
                <div class="character-actions">
                    <button class="card-settings-btn" 
                            data-character-key="${getCharacterKey(char)}"
                            data-character-name="${char.CharacterName}">
                        ⚙️
                    </button>
                </div>
            </div>
            <div class="card-divider"></div>
            <div class="todo-section">
                ${todoHtml}
            </div>
        </div>
    `;
    }).join('');
}

// 토큰 상태 업데이트
function updateTokenStatus() {
    const token = getStoredToken();
    if (token) {
        tokenStatus.textContent = '✅ 토큰이 저장되어 있습니다.';
        tokenStatus.style.color = '#4CAF50';
    } else {
        tokenStatus.textContent = '❌ 토큰이 설정되지 않았습니다.';
        tokenStatus.style.color = '#f44336';
    }
}

// 모달 열기/닫기
function openTokenModal() {
    tokenModal.style.display = 'flex';
    const currentToken = getStoredToken();
    if (currentToken) {
        tokenInput.value = currentToken;
    }
    tokenInput.focus();
}

tokenSettingsBtn.addEventListener('click', openTokenModal);

cancelTokenBtn.addEventListener('click', () => {
    tokenModal.style.display = 'none';
});

// 모달 외부 클릭 시 닫기
tokenModal.addEventListener('click', (e) => {
    if (e.target === tokenModal) {
        tokenModal.style.display = 'none';
    }
});

// 토큰 저장
saveTokenBtn.addEventListener('click', () => {
    const token = tokenInput.value.trim();
    if (token) {
        saveToken(token);
        updateTokenStatus();
        tokenModal.style.display = 'none';
        alert('토큰이 저장되었습니다!');
    } else {
        alert('토큰을 입력해주세요.');
    }
});

// 토큰 삭제
clearTokenBtn.addEventListener('click', () => {
    if (confirm('정말 토큰을 삭제하시겠습니까?')) {
        clearToken();
        tokenInput.value = '';
        updateTokenStatus();
        alert('토큰이 삭제되었습니다.');
    }
});

// TODO 관리 모달
function openTodoModal() {
    todoModal.style.display = 'flex';
    renderTodoManagerList();
    // 최신 상태 동기화
    loadTodoCatalog();
}

function closeTodoModal() {
    todoModal.style.display = 'none';
}

todoManageBtn.addEventListener('click', openTodoModal);
todoModalCloseBtn.addEventListener('click', closeTodoModal);
todoModal.addEventListener('click', (e) => {
    if (e.target === todoModal) {
        closeTodoModal();
    }
});

// 원정대 TODO 관리 모달
function openExpeditionTodoModal() {
    expeditionTodoModal.style.display = 'flex';
    renderExpeditionTodoList();
    loadExpeditionTodoCatalog();
}

function closeExpeditionTodoModal() {
    expeditionTodoModal.style.display = 'none';
}

expeditionTodoManageBtn?.addEventListener('click', openExpeditionTodoModal);
expeditionTodoModalCloseBtn?.addEventListener('click', closeExpeditionTodoModal);
expeditionTodoModal?.addEventListener('click', (e) => {
    if (e.target === expeditionTodoModal) {
        closeExpeditionTodoModal();
    }
});

function openCharacterTodoModal(charKey, characterName) {
    activeTodoSelectionTarget = { charKey, characterName };
    renderCharacterTodoSelectionList(charKey, characterName);
    characterTodoModal.style.display = 'flex';
}

function closeCharacterTodoModal() {
    activeTodoSelectionTarget = null;
    characterTodoModal.style.display = 'none';
}

characterTodoCancelBtn?.addEventListener('click', closeCharacterTodoModal);
characterTodoModal?.addEventListener('click', (e) => {
    if (e.target === characterTodoModal) {
        closeCharacterTodoModal();
    }
});

characterTodoSaveBtn?.addEventListener('click', async () => {
    if (!activeTodoSelectionTarget || !characterTodoList) return;

    const selectedIds = Array.from(characterTodoList.querySelectorAll('input[type="checkbox"]:checked'))
        .map(input => input.dataset.groupId);

    const allGroupIds = todoGroups.map(group => group.groupId);
    const isAllSelected = selectedIds.length === allGroupIds.length && allGroupIds.every(id => selectedIds.includes(id));

    try {
        characterTodoSaveBtn.disabled = true;
        let savedEntry = null;
        if (isAllSelected) {
            savedEntry = await clearTodoSelectionForCharacter(activeTodoSelectionTarget.charKey);
        } else {
            savedEntry = await saveSelectedGroupsForCharacter(activeTodoSelectionTarget.charKey, selectedIds);
        }

        const prevCompleted = characterTodoState[activeTodoSelectionTarget.charKey]?.completed || {};
        characterTodoState = {
            ...characterTodoState,
            [activeTodoSelectionTarget.charKey]: {
                selectedGroups: savedEntry?.selectedGroups ?? null,
                completed: prevCompleted
            }
        };

        rerenderCurrentCardsWithTodos();
        closeCharacterTodoModal();
        showToast('TODO 그룹을 적용했습니다.');
    } catch (error) {
        console.error('캐릭터 TODO 그룹 저장 실패:', error);
        showToast('TODO 그룹 저장에 실패했습니다.', 'error');
    } finally {
        characterTodoSaveBtn.disabled = false;
    }
});

characterTodoSelectAllBtn?.addEventListener('click', () => {
    if (!characterTodoList) return;
    characterTodoList.querySelectorAll('input[type="checkbox"]').forEach(input => {
        input.checked = true;
    });
});

resultContainer.addEventListener('change', async (e) => {
    const checkbox = e.target.closest('.todo-checkbox');
    if (!checkbox) return;

    const { characterKey, groupId, itemId, expedition } = checkbox.dataset;
    const itemRow = checkbox.closest('.todo-item-row');
    if (!itemRow) return;
    const type = itemRow.dataset.type === 'counter' ? 'counter' : 'check';
    if (type === 'counter') {
        // 카운터형 체크박스는 클릭 핸들러에서 처리
        checkbox.checked = !checkbox.checked;
        return;
    }
    const targetCount = getTargetCountFromDataset(itemRow.dataset.target);

    let nextValue = checkbox.checked ? 1 : 0;
    if (type === 'counter') {
        if (Number.isFinite(targetCount)) {
            nextValue = checkbox.checked ? targetCount : 0;
        }
        console.log('[counter-checkbox-change]', {
            groupId,
            itemId,
            expedition,
            targetCount,
            nextValue
        });
    }

    await persistCounterValue(itemRow, nextValue);
});

resultContainer.addEventListener('click', async (e) => {
    const checkArea = e.target.closest('.todo-check');
    const row = checkArea?.closest('.todo-item-row');
    if (row && row.dataset.type === 'counter') {
        e.preventDefault();
        const targetCount = getTargetCountFromDataset(row.dataset.target);
        const currentValue = parseCounterValue(row.dataset.value);
        let nextValue;
        if (Number.isFinite(targetCount)) {
            nextValue = isTodoItemCompleted('counter', targetCount, currentValue) ? 0 : targetCount;
        } else {
            nextValue = currentValue + 1;
        }
        console.log('[counter-click]', { groupId: row.dataset.groupId, itemId: row.dataset.itemId, targetCount, currentValue, nextValue });
        await persistCounterValue(row, nextValue);
        return;
    }

    const progress = e.target.closest('.counter-progress');
    if (!progress) return;
    const progressRow = progress.closest('.todo-item-row');
    if (!progressRow) return;
    const targetCount = getTargetCountFromDataset(progressRow.dataset.target);
    const currentValue = parseCounterValue(progressRow.dataset.value);
    const nextValue = Number.isFinite(targetCount) ? Math.min(targetCount, currentValue + 1) : currentValue + 1;
    await persistCounterValue(progressRow, nextValue);
});

resultContainer.addEventListener('contextmenu', async (e) => {
    const row = e.target.closest('.counter-row');
    if (!row) return;
    e.preventDefault();
    const currentValue = parseCounterValue(row.dataset.value);
    const nextValue = Math.max(0, currentValue - 1);
    await persistCounterValue(row, nextValue);
});

resultContainer.addEventListener('click', (e) => {
    const settingsBtn = e.target.closest('.card-settings-btn');
    if (settingsBtn) {
        const { characterKey, characterName } = settingsBtn.dataset;
        openCharacterTodoModal(characterKey, characterName);
        e.stopPropagation();
        return;
    }
});

resultContainer.addEventListener('mousedown', (e) => {
    if (e.target.closest('.card-settings-btn')) {
        e.stopPropagation();
    }
}, true);

todoGroupAddBtn.addEventListener('click', async () => {
    const name = todoGroupInput.value.trim();
    if (!name) {
        showToast('그룹 이름을 입력하세요.', 'error');
        return;
    }

    todoGroupAddBtn.disabled = true;
    try {
        const newGroup = await createTodoGroup(name, todoGroups.length);
        todoGroups = [...todoGroups, newGroup];
        todoGroupInput.value = '';
        renderTodoManagerList();
        rerenderCurrentCardsWithTodos();
        showToast('TODO 그룹을 추가했습니다.');
    } catch (error) {
        console.error('TODO 그룹 추가 실패:', error);
        showToast('TODO 그룹 추가에 실패했습니다.', 'error');
    } finally {
        todoGroupAddBtn.disabled = false;
    }
});

todoManagerList.addEventListener('click', async (e) => {
    const addBtn = e.target.closest('.todo-item-add-btn');
    if (addBtn) {
        const groupId = addBtn.dataset.groupId;
        const input = document.getElementById(`todo-item-input-${groupId}`);
        if (!input) return;
        const value = input.value.trim();
        if (!value) {
            showToast('항목 이름을 입력하세요.', 'error');
            return;
        }
        const typeSelect = document.getElementById(`todo-item-type-${groupId}`);
        const targetInput = document.getElementById(`todo-item-target-${groupId}`);
        const selectedType = typeSelect?.value === 'counter' ? 'counter' : 'check';
        const parsedTarget = Number(targetInput?.value);
        const targetCount = selectedType === 'counter' && Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;

        addBtn.disabled = true;
        try {
            const group = todoGroups.find(g => g.groupId === groupId);
            const newItem = await addTodoItem(groupId, value, (group?.items?.length ?? 0), selectedType, targetCount);
            if (group) {
                group.items = [...(group.items || []), newItem];
            }
            input.value = '';
            if (typeSelect) typeSelect.value = 'check';
            if (targetInput) targetInput.value = '';
            renderTodoManagerList();
            rerenderCurrentCardsWithTodos();
            showToast('항목을 추가했습니다.');
        } catch (error) {
            console.error('TODO 항목 추가 실패:', error);
            showToast('항목 추가에 실패했습니다.', 'error');
        } finally {
            addBtn.disabled = false;
        }
        return;
    }

    const deleteItemBtn = e.target.closest('.todo-item-delete-btn');
    if (deleteItemBtn) {
        const { groupId, itemId } = deleteItemBtn.dataset;
        const confirmed = await showConfirmModal('이 항목을 삭제하시겠습니까?');
        if (!confirmed) return;

        try {
            await deleteTodoItem(groupId, itemId);
            const group = todoGroups.find(g => g.groupId === groupId);
            if (group) {
                group.items = (group.items || []).filter(item => item.itemId !== itemId);
            }
            renderTodoManagerList();
            rerenderCurrentCardsWithTodos();
            showToast('항목을 삭제했습니다.');
        } catch (error) {
            console.error('TODO 항목 삭제 실패:', error);
            showToast('항목 삭제에 실패했습니다.', 'error');
        }
        return;
    }

    const moveBtn = e.target.closest('.todo-group-move-btn');
    if (moveBtn) {
        const { groupId, direction } = moveBtn.dataset;
        await moveTodoGroup(groupId, direction);
        return;
    }

    const moveItemBtn = e.target.closest('.todo-item-move-btn');
    if (moveItemBtn) {
        const { groupId, itemId, direction } = moveItemBtn.dataset;
        await moveTodoItem(groupId, itemId, direction);
        return;
    }

    const deleteGroupBtn = e.target.closest('.todo-group-delete-btn');
    if (deleteGroupBtn) {
        const groupId = deleteGroupBtn.dataset.groupId;
        const targetGroup = todoGroups.find(g => g.groupId === groupId);
        const confirmed = await showConfirmModal(`"${targetGroup?.name || '그룹'}" 그룹을 삭제하시겠습니까?`);
        if (!confirmed) return;

        try {
            await deleteTodoGroup(groupId);
            todoGroups = todoGroups.filter(g => g.groupId !== groupId);
            renderTodoManagerList();
            rerenderCurrentCardsWithTodos();
            showToast('TODO 그룹을 삭제했습니다.');
        } catch (error) {
            console.error('TODO 그룹 삭제 실패:', error);
            showToast('그룹 삭제에 실패했습니다.', 'error');
        }
    }
});

expeditionTodoAddBtn?.addEventListener('click', async () => {
    const name = expeditionTodoInput.value.trim();
    if (!name) {
        showToast('원정대 TODO 내용을 입력하세요.', 'error');
        return;
    }
    const selectedType = expeditionTodoTypeSelect?.value === 'counter' ? 'counter' : 'check';
    const parsedTarget = Number(expeditionTodoTargetInput?.value);
    const targetCount = selectedType === 'counter' && Number.isFinite(parsedTarget) && parsedTarget > 0 ? parsedTarget : null;

    expeditionTodoAddBtn.disabled = true;
    try {
        const newItem = await addExpeditionTodoItem(name, expeditionTodoItems.length, selectedType, targetCount);
        expeditionTodoItems = [...expeditionTodoItems, newItem];
        expeditionTodoInput.value = '';
        if (expeditionTodoTypeSelect) expeditionTodoTypeSelect.value = 'check';
        if (expeditionTodoTargetInput) expeditionTodoTargetInput.value = '';
        renderExpeditionTodoList();
        rerenderCurrentCardsWithTodos();
        showToast('원정대 TODO를 추가했습니다.');
    } catch (error) {
        console.error('원정대 TODO 추가 실패:', error);
        showToast('원정대 TODO 추가에 실패했습니다.', 'error');
    } finally {
        expeditionTodoAddBtn.disabled = false;
    }
});

expeditionTodoList?.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.expedition-item-delete-btn');
    if (deleteBtn) {
        const { itemId } = deleteBtn.dataset;
        const confirmed = await showConfirmModal('이 원정대 TODO를 삭제하시겠습니까?');
        if (!confirmed) return;
        try {
            await deleteExpeditionTodoItem(itemId);
            expeditionTodoItems = expeditionTodoItems.filter(item => item.itemId !== itemId);
            renderExpeditionTodoList();
            rerenderCurrentCardsWithTodos();
            showToast('원정대 TODO를 삭제했습니다.');
        } catch (error) {
            console.error('원정대 TODO 삭제 실패:', error);
            showToast('원정대 TODO 삭제에 실패했습니다.', 'error');
        }
        return;
    }

    const moveBtn = e.target.closest('.expedition-item-move-btn');
    if (moveBtn) {
        const { itemId, direction } = moveBtn.dataset;
        await moveExpeditionTodoItem(itemId, direction);
    }
});

// 그룹 추가 모달
function openAddGroupModal() {
    addGroupModal.style.display = 'flex';
    addGroupInput.value = '';
    addGroupInput.focus();
}

function closeAddGroupModal() {
    addGroupModal.style.display = 'none';
}

addGroupBtn.addEventListener('click', openAddGroupModal);
addGroupCancelBtn.addEventListener('click', closeAddGroupModal);

addGroupModal.addEventListener('click', (e) => {
    if (e.target === addGroupModal) {
        closeAddGroupModal();
    }
});

addGroupInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addGroupConfirmBtn.click();
    }
});

addGroupConfirmBtn.addEventListener('click', () => {
    const characterName = addGroupInput.value.trim();
    if (!characterName) {
        alert('캐릭터 이름을 입력해주세요.');
        return;
    }
    closeAddGroupModal();
    searchCharacter(characterName);
});

// 캐릭터 검색 함수
async function searchCharacter(characterName) {
    showLoading(true);

    try {
        console.log(`캐릭터 조회 중: ${characterName}`);
        const siblings = await getCharacterSiblings(characterName);

        console.log('API 응답:', siblings);

        if (!siblings || siblings.length === 0) {
            alert(`캐릭터 "${characterName}"를 찾을 수 없습니다.`);
            return;
        }

        // RTDB에 저장
        const savedGroup = await saveCharacterGroup(siblings);
        console.log('저장 완료:', savedGroup);

        // 그룹 목록에 추가
        allGroups.unshift(savedGroup);

        // 탭 렌더링 (새 그룹이 즉시 표시되도록)
        renderTabs();

        // 새로 추가된 그룹 선택
        selectGroup(savedGroup.groupId);

        alert(`"${savedGroup.representativeName}" 그룹이 저장되었습니다!`);

    } catch (error) {
        console.error('캐릭터 조회 실패:', error);
        displayError(error.message);
    } finally {
        showLoading(false);
    }
}

// 에러 표시
function displayError(message) {
    resultContainer.innerHTML = `
        <div class="error-message">
            <h3>❌ 오류 발생</h3>
            <p>${message}</p>
            <button onclick="document.getElementById('token-settings-btn').click()" class="primary-btn">
                토큰 설정하기
            </button>
        </div>
    `;
}

// 캐릭터 키 생성 (이름 + 서버)
function getCharacterKey(char) {
    return `${char.CharacterName || ''}__${char.ServerName || ''}`;
}

// 캐릭터별 더미 Todo 생성 (해시 기반으로 2~3개 결정)
function getDummyTodosForCharacter(char) {
    const todoPool = [
        '카오스 던전 2회 돌기',
        '가디언 토벌 1회 완료',
        '에포나 일일 의뢰 3회',
        '길드 출석 및 기부',
        '실마엘 혈석 교환 확인',
        '생활 재료 수확'
    ];

    const seed = hashString(getCharacterKey(char));
    const todoCount = 2 + (seed % 2); // 2 또는 3개
    const startIndex = seed % todoPool.length;

    const todos = [];
    for (let i = 0; i < todoCount; i++) {
        const nextIndex = (startIndex + i * 2) % todoPool.length;
        todos.push(todoPool[nextIndex]);
    }

    return todos;
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0; // 32비트 정수로 변환
    }
    return Math.abs(hash);
}

// 화면 표시 순서 정렬
function getCharactersInDisplayOrder(characters) {
    return [...(characters || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

// 드래그 앤 드롭 설정
function setupDragAndDrop(groupId) {
    const grid = resultContainer.querySelector('.characters-grid');
    if (!grid) return;

    let dragState = null;

    grid.addEventListener('dragstart', (e) => {
        const handle = e.target.closest('.drag-handle');
        if (!handle) return;
        const card = handle.closest('.character-card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        dragState = {
            card,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            width: rect.width,
            height: rect.height
        };
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
        // Show the whole card as the drag preview instead of just the handle.
        e.dataTransfer.setDragImage(card, dragState.offsetX, dragState.offsetY);
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        if (!dragState) return;
        const { card: draggingCard, offsetX, offsetY, width, height } = dragState;

        // Use the dragging card's center as the reference point to avoid jitter around corners.
        const referenceX = e.clientX - offsetX + width / 2;
        const referenceY = e.clientY - offsetY + height / 2;

        const targetCard = getNearestCard(grid, referenceX, referenceY, draggingCard);
        if (!targetCard) {
            grid.appendChild(draggingCard);
            return;
        }
        insertAtPosition(grid, draggingCard, targetCard, referenceX, referenceY);
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
    });

    grid.addEventListener('dragend', async () => {
        if (!dragState) return;
        dragState.card.classList.remove('dragging');
        dragState = null;

        const cards = Array.from(grid.querySelectorAll('.character-card'));
        await persistCharacterOrder(groupId, cards);
    });
}

function getNearestCard(container, x, y, draggingCard = null) {
    const cards = [...container.querySelectorAll('.character-card')]
        .filter(card => card !== draggingCard);
    if (!cards.length) return null;

    let closest = { element: null, distance: Number.POSITIVE_INFINITY };

    cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const distance = Math.hypot(x - cx, y - cy);

        if (distance < closest.distance) {
            closest = { element: card, distance };
        }
    });

    return closest.element;
}

function insertAtPosition(container, draggingCard, targetCard, pointerX, pointerY) {
    if (!targetCard || !draggingCard) return;

    const rect = targetCard.getBoundingClientRect();
    const targetCenterY = rect.top + rect.height / 2;
    const targetCenterX = rect.left + rect.width / 2;
    const isAfter = pointerY > targetCenterY || (Math.abs(pointerY - targetCenterY) < rect.height * 0.1 && pointerX > targetCenterX);

    if (isAfter) {
        container.insertBefore(draggingCard, targetCard.nextSibling);
    } else {
        container.insertBefore(draggingCard, targetCard);
    }
}

async function persistCharacterOrder(groupId, cards) {
    const groupIndex = allGroups.findIndex(g => g.groupId === groupId);
    if (groupIndex === -1) return;

    const targetGroup = allGroups[groupIndex];
    const characterMap = new Map((targetGroup.characters || []).map(char => [getCharacterKey(char), char]));

    cards.forEach((card, index) => {
        card.dataset.displayOrder = index;
        const badge = card.querySelector('.order-badge');
        if (badge) {
            badge.textContent = `#${index + 1}`;
        }
    });

    const reorderedCharacters = cards.map((card, index) => {
        const key = card.dataset.characterKey;
        const original = characterMap.get(key) || {};
        return {
            ...original,
            displayOrder: index
        };
    });

    allGroups[groupIndex] = {
        ...targetGroup,
        characters: reorderedCharacters
    };

    try {
        await updateCharacterOrder(groupId, reorderedCharacters);
        showToast('순서를 저장했습니다.');
    } catch (error) {
        console.error('순서 저장 실패:', error);
        showToast('순서 저장에 실패했습니다.', 'error');
    }
}

function parseItemLevelValue(level) {
    const levelStr = String(level ?? '').replace(/,/g, '');
    const match = levelStr.match(/^\d+\.?\d*/);
    return match ? parseFloat(match[0]) : 0;
}

function mergeCharactersPreserveOrder(existing, incoming) {
    const filteredIncoming = (incoming || []).filter(char => parseItemLevelValue(char.ItemAvgLevel) >= 1000);
    const cleanedIncoming = filteredIncoming.map(char => {
        const { ItemMaxLevel, ...rest } = char;
        return rest;
    });

    const incomingMap = new Map(cleanedIncoming.map(char => [getCharacterKey(char), char]));
    const sortedExisting = [...(existing || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));

    const merged = [];

    sortedExisting.forEach((oldChar) => {
        const key = getCharacterKey(oldChar);
        if (!incomingMap.has(key)) return;
        const nextChar = incomingMap.get(key);
        merged.push({ ...nextChar, displayOrder: merged.length });
        incomingMap.delete(key);
    });

    const remaining = Array.from(incomingMap.values())
        .sort((a, b) => parseItemLevelValue(b.ItemAvgLevel) - parseItemLevelValue(a.ItemAvgLevel));

    remaining.forEach((char) => {
        merged.push({ ...char, displayOrder: merged.length });
    });

    return merged;
}

async function refreshGroupData(groupId) {
    const targetGroup = allGroups.find(g => g.groupId === groupId);
    if (!targetGroup) return;

    showLoading(true);
    try {
        showToast('최신 정보 불러오는 중...');
        const siblings = await getCharacterSiblings(targetGroup.representativeName);

        if (!siblings || siblings.length === 0) {
            showToast('캐릭터 정보를 불러올 수 없습니다.', 'error');
            return;
        }

        const mergedCharacters = mergeCharactersPreserveOrder(targetGroup.characters || [], siblings);

        allGroups = allGroups.map(group => {
            if (group.groupId !== groupId) return group;
            return {
                ...group,
                characters: mergedCharacters
            };
        });

        await updateCharacterOrder(groupId, mergedCharacters);

        renderTabs();
        selectGroup(currentGroupId || groupId);
        showToast('최신 정보로 갱신했습니다.');
    } catch (error) {
        console.error('그룹 갱신 실패:', error);
        showToast('갱신에 실패했습니다.', 'error');
    } finally {
        showLoading(false);
    }
}

// 로딩 표시
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.add('active');
    } else {
        loadingSpinner.classList.remove('active');
    }
}
