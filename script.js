document.addEventListener('DOMContentLoaded', () => {
    // Input Elements
    const activityInput = document.getElementById('activity-input');
    const priorityInput = document.getElementById('priority-input');
    const addItemBtn = document.getElementById('add-item-btn');

    // List Element
    const todoList = document.getElementById('todo-list');

    // Progress Bar Elements
    const progressBar = document.getElementById('progress-bar');
    const progressPercentage = document.getElementById('progress-percentage');

    // Modal elements
    const confirmModal = document.getElementById('custom-confirm-modal');
    const confirmYesBtn = document.getElementById('confirm-yes-btn');
    const confirmNoBtn = document.getElementById('confirm-no-btn');
    let itemToDelete = null; // Store the list item element (li) to delete
    let deleteCallback = null; // Store the function to call on confirmation

    // Load items and render the list initially
    renderList();

    // Event Listeners
    addItemBtn.addEventListener('click', addItem);
    todoList.addEventListener('click', handleListClick); // Handles both check and delete
    activityInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            addItem();
        }
    });

    // --- Main Functions ---

    function addItem() {
        const activityText = activityInput.value.trim();
        const priorityValue = parseInt(priorityInput.value);

        if (activityText === '') {
            alert('할 일을 입력해주세요.');
            activityInput.focus();
            return;
        }
        // Check if priorityInput is empty first
        if (priorityInput.value.trim() === '') {
             alert('우선순위를 입력해주세요.');
             priorityInput.focus();
             return;
        }
        // Then check if it's a valid number within the range
        if (isNaN(priorityValue) || priorityValue < 1 || priorityValue > 5) {
            alert('우선순위는 1에서 5 사이의 숫자로 입력해주세요.');
            priorityInput.value = ''; // Clear invalid input
            priorityInput.focus();
            return;
        }

        // Get current items to determine the next index *before* adding
        const currentItems = getItemsFromLocalStorage();
        const nextIndex = currentItems.length > 0 ? Math.max(...currentItems.map(item => item.itemIndex || 0)) + 1 : 1;

        const newItem = {
            id: Date.now(),
            activity: activityText,
            priority: priorityValue,
            completed: false,
            itemIndex: nextIndex // Store the persistent index
        };

        saveItemToLocalStorage(newItem);
        renderList();

        // Clear inputs
        activityInput.value = '';
        priorityInput.value = '';
        activityInput.focus();
    }

    function renderList() {
        const items = getItemsFromLocalStorage();
        const sortedItems = sortItems(items);

        todoList.innerHTML = '';
        sortedItems.forEach(item => displayItem(item));

        updateProgress();
    }

    function sortItems(items) {
        return items.sort((a, b) => {
            // 1. Sort by completion status (incomplete first)
            if (a.completed !== b.completed) {
                return a.completed ? 1 : -1;
            }
            // 2. Sort by priority (lower number first)
            if (a.priority !== b.priority) {
                return a.priority - b.priority;
            }
            // 3. Sort by creation time (older first)
            return a.id - b.id;
        });
    }

    function displayItem(item) {
        const li = document.createElement('li');
        li.classList.add('todo-item');
        li.dataset.id = item.id;
        if (item.completed) {
            li.classList.add('completed');
        }

        // Use the stored itemIndex for numbering
        li.innerHTML = `
            <span class="todo-no">${item.itemIndex || '-'}</span> <!-- Use stored index -->
            <span class="todo-activity">${item.activity}</span>
            <span class="todo-priority">${item.priority}</span>
            <span class="todo-check">
                <input type="checkbox" class="complete-checkbox" ${item.completed ? 'checked' : ''}>
            </span>
            <span class="todo-actions">
                <button class="delete-btn">삭제</button>
            </span>
        `;
        todoList.appendChild(li);
    }

    function handleListClick(event) {
        const target = event.target;

        // Handle checkbox click
        if (target.classList.contains('complete-checkbox')) {
            const li = target.closest('li.todo-item');
            const itemId = li.dataset.id;
            toggleItemCompletion(itemId); // Update data in localStorage
            renderList(); // Re-render the list to reflect sorting change
        }

        // Handle delete button click
        if (target.classList.contains('delete-btn')) {
            itemToDelete = target.closest('li.todo-item');
            deleteCallback = () => {
                const itemId = itemToDelete.dataset.id;
                // Don't remove from DOM directly
                removeItemFromLocalStorage(itemId);
                renderList(); // Re-render the list after deletion
            };
            showConfirmModal();
        }
    }

    function toggleItemCompletion(itemId) {
        let items = getItemsFromLocalStorage();
        items = items.map(item => {
            // Ensure comparison works correctly (string vs number)
            if (item.id.toString() === itemId) {
                return { ...item, completed: !item.completed };
            }
            return item;
        });
        localStorage.setItem('todos', JSON.stringify(items));
    }

    function updateProgress() {
        const items = getItemsFromLocalStorage();
        const totalItems = items.length;
        if (totalItems === 0) {
            progressBar.style.width = '0%';
            progressPercentage.textContent = '0%';
            return;
        }
        const completedItems = items.filter(item => item.completed).length;
        const percentage = Math.round((completedItems / totalItems) * 100);

        progressBar.style.width = `${percentage}%`;
        progressPercentage.textContent = `${percentage}%`;
    }

    // --- Modal Functions ---
    function showConfirmModal() {
        confirmModal.style.display = 'flex';
        // Attach listeners specifically for this confirmation
        confirmYesBtn.addEventListener('click', handleConfirmYes);
        confirmNoBtn.addEventListener('click', handleConfirmNo);
    }

    function hideConfirmModal() {
        confirmModal.style.display = 'none';
        itemToDelete = null;
        deleteCallback = null;
        // IMPORTANT: Remove listeners to prevent multiple executions
        confirmYesBtn.removeEventListener('click', handleConfirmYes);
        confirmNoBtn.removeEventListener('click', handleConfirmNo);
    }

    function handleConfirmYes() {
        if (deleteCallback) {
            deleteCallback(); // Executes the logic set in handleListClick
        }
        hideConfirmModal();
    }

    function handleConfirmNo() {
        hideConfirmModal();
    }

    // --- Local Storage Functions ---
    function getItemsFromLocalStorage() {
        const items = JSON.parse(localStorage.getItem('todos') || '[]');
        // Simple migration for items without itemIndex
        let maxIndex = 0;
        items.forEach(item => {
            if (item.itemIndex && item.itemIndex > maxIndex) {
                maxIndex = item.itemIndex;
            }
        });
        let updated = false;
        items.forEach((item, idx) => {
            if (!item.itemIndex) {
                item.itemIndex = ++maxIndex; // Assign next available index
                updated = true;
            }
        });
        // If we added missing indices, update localStorage
        if (updated) {
             localStorage.setItem('todos', JSON.stringify(items));
        }
        return items;
    }

    function saveItemToLocalStorage(item) {
        const items = getItemsFromLocalStorage();
        items.push(item);
        localStorage.setItem('todos', JSON.stringify(items));
    }

    function removeItemFromLocalStorage(itemId) {
        let items = getItemsFromLocalStorage();
        items = items.filter(item => item.id.toString() !== itemId);
        localStorage.setItem('todos', JSON.stringify(items));
    }
}); 