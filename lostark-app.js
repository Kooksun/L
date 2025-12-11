import { getStoredToken, saveToken, clearToken, getCharacterSiblings } from './lostark-api.js';
import { TEST_TOKEN } from './test-token.js';
import { saveCharacterGroup, getAllCharacterGroups, deleteCharacterGroup } from './character-storage.js';

const characterInput = document.getElementById('character-input');
const searchBtn = document.getElementById('search-btn');
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

    const tabsHtml = allGroups.map(group => `
        <div class="tab ${currentGroupId === group.groupId ? 'active' : ''}" 
             data-group-id="${group.groupId}">
            <span class="tab-name">${group.representativeName}</span>
            <button class="tab-delete-btn" data-group-id="${group.groupId}" title="삭제">×</button>
        </div>
    `).join('');

    tabsContainer.innerHTML = tabsHtml;

    // 이벤트 위임 방식으로 한 번만 등록
    setupTabEvents();
}

// 탭 이벤트 설정 (한 번만 호출)
let tabEventsSetup = false;
function setupTabEvents() {
    if (tabEventsSetup) return;
    tabEventsSetup = true;

    // 이벤트 위임: tabsContainer에 한 번만 등록
    tabsContainer.addEventListener('click', async (e) => {
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
}

// 그룹 선택
function selectGroup(groupId) {
    currentGroupId = groupId;
    const group = allGroups.find(g => g.groupId === groupId);

    if (group) {
        // 활성 탭 CSS만 업데이트 (renderTabs 호출하지 않음)
        document.querySelectorAll('.tab').forEach(tab => {
            if (tab.dataset.groupId === groupId) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });

        displayCharacters(group);
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

        // 삭제된 그룹이 현재 선택된 그룹이면 다른 그룹 선택
        if (currentGroupId === groupId) {
            currentGroupId = null;
            resultContainer.innerHTML = '';

            if (allGroups.length > 0) {
                selectGroup(allGroups[0].groupId);
            }
        }

        renderTabs();
        showToast('그룹이 삭제되었습니다.', 'success');
    } catch (error) {
        showToast('그룹 삭제에 실패했습니다.', 'error');
    }
}

// 캐릭터 표시
function displayCharacters(group) {
    const characters = group.characters;

    const html = `
        <div class="character-list">
            <h2>🎭 ${group.representativeName}의 형제 캐릭터 (${characters.length}개)</h2>
            <div class="characters-grid">
                ${characters.map(char => `
                    <div class="character-card">
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
                `).join('')}
            </div>
        </div>
    `;

    resultContainer.innerHTML = html;
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

// 검색 이벤트
searchBtn.addEventListener('click', () => {
    const characterName = characterInput.value.trim();
    if (characterName) {
        searchCharacter(characterName);
    }
});

characterInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        const characterName = characterInput.value.trim();
        if (characterName) {
            searchCharacter(characterName);
        }
    }
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

        // 입력 필드 초기화
        characterInput.value = '';

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

// 로딩 표시
function showLoading(show) {
    if (show) {
        loadingSpinner.classList.add('active');
    } else {
        loadingSpinner.classList.remove('active');
    }
}
