const API_URL = "https://kooksun-hr-default-rtdb.firebaseio.com/todos";

const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const dateDisplay = document.getElementById('date-display');
const loadingSpinner = document.getElementById('loading');

// Date Display
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
dateDisplay.textContent = new Date().toLocaleDateString('ko-KR', options);

// Load Todos on Start
document.addEventListener('DOMContentLoaded', async () => {
    await checkAndResetWeekly();
    fetchTodos();
});

// Add Todo Event
addBtn.addEventListener('click', addTodo);
todoInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addTodo();
});

// Weekly Reset Logic (Wed 10:00 AM)
async function checkAndResetWeekly() {
    try {
        const metaResponse = await fetch(`https://kooksun-hr-default-rtdb.firebaseio.com/meta.json`);
        const metaData = await metaResponse.json() || {};
        const lastReset = metaData.lastReset ? new Date(metaData.lastReset) : new Date(0);

        const now = new Date();
        const resetTarget = new Date(now);

        // Find most recent Wednesday 10:00 AM
        // Day 0=Sun, 1=Mon, 2=Tue, 3=Wed...
        const currentDay = now.getDay();
        const distanceToWed = (currentDay + 7 - 3) % 7; // Distance from last Wed (0 if today is Wed)

        resetTarget.setDate(now.getDate() - distanceToWed);
        resetTarget.setHours(10, 0, 0, 0);

        // If today is Wednesday but BEFORE 10AM, we should look at LAST week's Wed
        if (distanceToWed === 0 && now < resetTarget) {
            resetTarget.setDate(resetTarget.getDate() - 7);
        }

        console.log("Last Reset:", lastReset.toLocaleString());
        console.log("Target Reset Time:", resetTarget.toLocaleString());

        if (lastReset < resetTarget) {
            console.log("Resetting todos...");
            // 1. Fetch current todos to find what to reset (or reset all)
            // Ideally we reset ALL, but we only have list.
            // Let's do a batch update approach or loop. REST API doesn't have batch update easily without ID.
            // We'll fetch logic inside here for safety.

            const todoResponse = await fetch(`${API_URL}.json`);
            const todoData = await todoResponse.json();

            if (todoData) {
                const updates = {};
                Object.keys(todoData).forEach(key => {
                    // Set completed to false
                    updates[`${key}/completed`] = false;
                });

                // Use PATCH to update multiple paths at root if structure allows, 
                // but Firebase PATCH at root merges. updates object needs full paths from root...
                // Actually `PATCH /todos.json` with { "id1/completed": false } doesn't work deep.
                // We have to iterate or do a `PUT` of the whole object (risky).
                // Safest for this simple app: Iterate fetches. Performance is okay for small list.
                // Better: PATCH `https://.../todos.json` with the whole modified object map?
                // Let's iterate parallel requests.

                const promises = Object.keys(todoData).map(key =>
                    fetch(`${API_URL}/${key}.json`, {
                        method: 'PATCH',
                        body: JSON.stringify({ completed: false })
                    })
                );
                await Promise.all(promises);

                alert("매주 수요일 아침 10시 리셋! 모든 할 일이 초기화되었습니다.");
            }

            // 2. Update lastReset
            await fetch(`https://kooksun-hr-default-rtdb.firebaseio.com/meta.json`, {
                method: 'PATCH',
                body: JSON.stringify({ lastReset: now.toISOString() })
            });
        }
    } catch (error) {
        console.error("Weekly reset check failed:", error);
    }
}

async function fetchTodos() {
    showLoading(true);
    todoList.innerHTML = '';
    try {
        const response = await fetch(`${API_URL}.json`);
        const data = await response.json();

        if (data) {
            // Firebase returns object with keys, convert to array for sorting/display
            const todos = Object.keys(data).map(key => ({
                id: key,
                ...data[key]
            }));

            todos.forEach(todo => renderTodo(todo));
        }
    } catch (error) {
        console.error("Error fetching todos:", error);
        alert("할 일을 불러오는데 실패했습니다.");
    } finally {
        showLoading(false);
    }
}

async function addTodo() {
    const text = todoInput.value.trim();
    if (!text) return;

    const newTodo = {
        text: text,
        completed: false,
        createdAt: new Date().toISOString()
    };

    try {
        // Optimistic UI update could be done here, but waiting for server is safer for consistent ID
        const response = await fetch(`${API_URL}.json`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newTodo)
        });

        const data = await response.json();
        // Firebase returns { name: "new_id" }
        newTodo.id = data.name;

        renderTodo(newTodo);
        todoInput.value = '';
        todoInput.focus();

    } catch (error) {
        console.error("Error adding todo:", error);
        alert("저장 실패");
    }
}

async function toggleTodo(id, currentStatus) {
    try {
        await fetch(`${API_URL}/${id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: !currentStatus })
        });

        // UI update is handled by the change event listener finding the element
        // But we need to update the DOM logic if we didn't purely rely on reload
        // Since we are not reloading, we just let the checkbox state stay as is
    } catch (error) {
        console.error("Error updating todo:", error);
        // Revert change in UI if needed, but simple alert for now
        alert("상태 변경 실패");
        fetchTodos(); // Reload to sync
    }
}

async function deleteTodo(id, element) {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
        await fetch(`${API_URL}/${id}.json`, {
            method: 'DELETE'
        });

        element.style.opacity = '0';
        element.style.transform = 'translateX(20px)';
        setTimeout(() => element.remove(), 300);

    } catch (error) {
        console.error("Error deleting todo:", error);
        alert("삭제 실패");
    }
}

function renderTodo(todo) {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;

    // Checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'todo-checkbox';
    checkbox.checked = todo.completed;
    checkbox.addEventListener('change', () => {
        li.classList.toggle('completed');
        toggleTodo(todo.id, !li.classList.contains('completed')); // passed wrong status initially, fixing logic
        // Actually, toggleTodo takes the OLD status to flip it, OR we pass the NEW status
        // Let's rely on the current known state.
        // Wait, I passed `!currentStatus` in toggleTodo.
        // In the listener, `todo.completed` is stale.
        // Let's just pass `checkbox.checked` as the TARGET state.
        updateTodoStatus(todo.id, checkbox.checked);
    });

    // Text (Click to toggle also)
    const span = document.createElement('span');
    span.className = 'todo-text';
    span.textContent = todo.text;
    span.addEventListener('click', () => {
        checkbox.checked = !checkbox.checked;
        li.classList.toggle('completed');
        updateTodoStatus(todo.id, checkbox.checked);
    });

    // Delete Button
    const delBtn = document.createElement('button');
    delBtn.className = 'delete-btn';
    delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
    delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteTodo(todo.id, li);
    });

    li.appendChild(checkbox);
    li.appendChild(span);
    li.appendChild(delBtn);

    // Prepend to list (newest first usually looks better, but append is standard)
    // users usually expect newest at bottom for todo list, or top. 
    // Let's append for now.
    todoList.appendChild(li);
}

// Fixed update function to be clearer
async function updateTodoStatus(id, isCompleted) {
    try {
        await fetch(`${API_URL}/${id}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ completed: isCompleted })
        });
    } catch (error) {
        console.error("Error updating todo:", error);
        alert("상태 변경 실패");
    }
}

function showLoading(show) {
    if (show) loadingSpinner.classList.add('active');
    else loadingSpinner.classList.remove('active');
}
