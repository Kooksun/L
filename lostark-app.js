import { getStoredToken, saveToken, clearToken, getCharacterSiblings } from './lostark-api.js';
import { TEST_TOKEN } from './test-token.js';
import { saveCharacterGroup, getAllCharacterGroups, deleteCharacterGroup, updateCharacterOrder } from './character-storage.js';

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

// 그룹 추가 모달 관련
const addGroupBtn = document.getElementById('add-group-btn');
const addGroupModal = document.getElementById('add-group-modal');
const addGroupInput = document.getElementById('add-group-input');
const addGroupConfirmBtn = document.getElementById('add-group-confirm-btn');
const addGroupCancelBtn = document.getElementById('add-group-cancel-btn');

// 현재 선택된 그룹
let currentGroupId = null;
let allGroups = [];

// 날짜 표시
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
dateDisplay.textContent = new Date().toLocaleDateString('ko-KR', options);

// 초기화
document.addEventListener('DOMContentLoaded', async () => {
    if (!getStoredToken()) {
        console.log('저장된 토큰이 없습니다. 테스트 토큰을 사용합니다.');
        saveToken(TEST_TOKEN);
        updateTokenStatus();
    } else {
        updateTokenStatus();
    }

    // 저장된 그룹 불러오기
    await loadAllGroups();
});

// 저장된 모든 그룹 불러오기
async function loadAllGroups() {
    showLoading(true);
    try {
        allGroups = await getAllCharacterGroups();
        renderTabs();

        // 첫 번째 그룹 자동 선택
        if (allGroups.length > 0) {
            selectGroup(allGroups[0].groupId);
        }
    } catch (error) {
        console.error('그룹 불러오기 실패:', error);
    } finally {
        showLoading(false);
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
            <div class="list-header">
                <h2>🎭 ${group.representativeName}의 캐릭터 (${characters.length}개)</h2>
                <div class="drag-hint">카드를 드래그해서 순서를 변경하세요</div>
            </div>
            <div class="characters-grid" data-group-id="${group.groupId}">
                ${buildCharacterCards(characters, { enableDrag: true })}
            </div>
        </div>
    `;

    resultContainer.innerHTML = html;
    setupDragAndDrop(group.groupId);
}

// 기타 그룹 표시 (6개 이하 그룹 모음)
function displayMiscGroups(miscGroups) {
    if (!miscGroups || miscGroups.length === 0) {
        resultContainer.innerHTML = '<p class="no-results">표시할 기타 그룹이 없습니다.</p>';
        return;
    }

    const html = `
        <div class="misc-groups">
            <h2>🗂 기타 그룹 (${miscGroups.length}개)</h2>
            ${miscGroups.map(group => `
                <div class="misc-group-card">
                    <div class="misc-group-header">
                        <div>
                            <div class="misc-group-name">${group.representativeName}</div>
                            <div class="misc-group-meta">${group.characters?.length || 0} 캐릭터</div>
                        </div>
                        <button class="danger-btn small group-delete-btn" data-group-id="${group.groupId}">삭제</button>
                    </div>
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
}

// 캐릭터 카드 HTML 생성
function buildCharacterCards(characters, options = {}) {
    const { enableDrag = false } = options;

    return characters.map(char => `
        <div class="character-card ${enableDrag ? 'draggable-card' : ''}" 
             ${enableDrag ? 'draggable="true"' : ''} 
             data-character-key="${getCharacterKey(char)}"
             data-display-order="${char.displayOrder ?? 0}">
            <div class="order-badge">#${(char.displayOrder ?? 0) + 1}</div>
            <div class="character-header">
                <h3>${char.CharacterName}</h3>
                <span class="server-badge">${char.ServerName}</span>
            </div>
            <div class="character-info">
                <div class="info-row">
                    <span class="label">직업:</span>
                    <span class="value">${char.CharacterClassName}</span>
                </div>
                <div class="info-row">
                    <span class="label">레벨:</span>
                    <span class="value level">${char.ItemAvgLevel}</span>
                </div>
            </div>
        </div>
    `).join('');
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
tokenSettingsBtn.addEventListener('click', () => {
    tokenModal.style.display = 'flex';
    const currentToken = getStoredToken();
    if (currentToken) {
        tokenInput.value = currentToken;
    }
});

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

// 화면 표시 순서 정렬
function getCharactersInDisplayOrder(characters) {
    return [...(characters || [])].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

// 드래그 앤 드롭 설정
function setupDragAndDrop(groupId) {
    const grid = resultContainer.querySelector('.characters-grid');
    if (!grid) return;

    let dragActive = null;

    grid.addEventListener('dragstart', (e) => {
        const card = e.target.closest('.character-card');
        if (!card) return;
        dragActive = card;
        card.classList.add('dragging');
        e.dataTransfer.setData('text/plain', '');
        e.dataTransfer.effectAllowed = 'move';
    });

    grid.addEventListener('dragover', (e) => {
        e.preventDefault();
        const draggingCard = grid.querySelector('.dragging');
        if (!draggingCard) return;

        const afterElement = getDragAfterElement(grid, e.clientY);
        if (!afterElement) {
            grid.appendChild(draggingCard);
        } else {
            grid.insertBefore(draggingCard, afterElement);
        }
    });

    grid.addEventListener('drop', (e) => {
        e.preventDefault();
    });

    grid.addEventListener('dragend', async () => {
        if (!dragActive) return;
        dragActive.classList.remove('dragging');
        dragActive = null;

        const cards = Array.from(grid.querySelectorAll('.character-card'));
        await persistCharacterOrder(groupId, cards);
    });
}

function getDragAfterElement(container, y) {
    const cards = [...container.querySelectorAll('.character-card:not(.dragging)')];

    return cards.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;

        if (offset < 0 && offset > closest.offset) {
            return { offset, element: child };
        }

        return closest;
    }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
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
