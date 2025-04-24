// Import necessary Firebase services from the config file
import { database, auth } from './firebase-config.js'; // Import auth as well
import { ref, set, onValue, remove, get } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js"; // Import auth state functions

// Removed Firebase App/Analytics/Database/Config initialization (now in firebase-config.js)

let todosRef = null; // Initialize todosRef as null, will be set based on user

// --- DOM Elements (Global scope for access within auth listener) ---
const todoList = document.getElementById('todo-list');
const activityInput = document.getElementById('activity-input');
const priorityInput = document.getElementById('priority-input');
const addItemBtn = document.getElementById('add-item-btn');
const progressBar = document.getElementById('progress-bar');
const progressPercentage = document.getElementById('progress-percentage');
const confirmModal = document.getElementById('custom-confirm-modal');
const confirmYesBtn = document.getElementById('confirm-yes-btn');
const confirmNoBtn = document.getElementById('confirm-no-btn');
const userWelcome = document.getElementById('user-welcome');
const logoutBtn = document.getElementById('logout-btn');
const loginLink = document.querySelector('.login-button-link'); // Select the link

// --- Global Variables ---
let itemToDelete = null;
let deleteCallback = null;
let currentItems = [];
let firebaseListenerUnsubscribe = null; // To detach listener on logout

// --- Firebase Auth State Listener ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is signed in
        console.log("User logged in:", user);
        displayLoggedInUI(user);
        initializeTodoListForUser(user.uid);
    } else {
        // User is signed out
        console.log("User logged out");
        displayLoggedOutUI();
        // Redirect to login page if not logged in
        if (window.location.pathname !== '/login.html' && window.location.pathname !== '/signup.html') {
            window.location.href = 'login.html';
        }
    }
});

// --- UI Update Functions ---
function displayLoggedInUI(user) {
    if (userWelcome) userWelcome.textContent = `환영합니다, ${user.displayName || user.email}님!`;
    if (userWelcome) userWelcome.style.display = 'inline';
    if (logoutBtn) logoutBtn.style.display = 'inline-block';
    if (loginLink) loginLink.style.display = 'none';

    // Add logout event listener only when logged in
    if (logoutBtn && !logoutBtn.hasAttribute('data-listener-added')) {
        logoutBtn.addEventListener('click', handleLogout);
        logoutBtn.setAttribute('data-listener-added', 'true'); // Prevent adding multiple listeners
    }
}

function displayLoggedOutUI() {
    if (userWelcome) userWelcome.style.display = 'none';
    if (logoutBtn) logoutBtn.style.display = 'none';
    if (loginLink) loginLink.style.display = 'inline-block';
    if (todoList) todoList.innerHTML = ''; // Clear list when logged out
    updateProgress(); // Reset progress bar

    // Detach Firebase listener if it exists
    if (firebaseListenerUnsubscribe) {
        firebaseListenerUnsubscribe();
        firebaseListenerUnsubscribe = null;
        console.log("Detached Firebase listener");
    }
    todosRef = null; // Reset todosRef
    currentItems = []; // Reset current items

    // Remove logout listener if it was added
    if (logoutBtn && logoutBtn.hasAttribute('data-listener-added')) {
        logoutBtn.removeEventListener('click', handleLogout);
        logoutBtn.removeAttribute('data-listener-added');
    }
}

// --- Todo List Initialization for Logged-in User ---
function initializeTodoListForUser(userId) {
    // Set the database reference to the user-specific path
    todosRef = ref(database, `todos/${userId}`);
    console.log("Setting Firebase ref to:", `todos/${userId}`);

    // Clear any existing items before setting up the new listener
    currentItems = [];
    if(todoList) todoList.innerHTML = '';
    updateProgress();

    // Detach previous listener if any before attaching a new one
    if (firebaseListenerUnsubscribe) {
        firebaseListenerUnsubscribe();
    }

    // Setup the real-time listener for the specific user's todos
    setupFirebaseListener();

    // Add event listeners for todo actions (ensure they are added only once)
    if (addItemBtn && !addItemBtn.hasAttribute('data-listener-added')) {
        addItemBtn.addEventListener('click', addItem);
        activityInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addItem();
        });
        if(todoList) todoList.addEventListener('click', handleListClick); // Handles both check and delete
        
        addItemBtn.setAttribute('data-listener-added', 'true');
    }
}

// --- Logout Handler ---
async function handleLogout() {
    try {
        await signOut(auth);
        console.log("Logout successful");
        // onAuthStateChanged will handle UI updates and redirection
    } catch (error) {
        console.error("Logout failed:", error);
        alert("로그아웃 중 오류가 발생했습니다.");
    }
}

// --- Main Todo Functions (Mostly unchanged, but use the global todosRef) ---

function addItem() {
    if (!todosRef) {
        alert("로그인이 필요합니다.");
        return;
    }
    // Ensure user is logged in before adding item
    const user = auth.currentUser;
    if (!user) {
        alert("로그인이 필요합니다.");
        window.location.href = 'login.html'; // Redirect if not logged in
        return;
    }
    const userId = user.uid;

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

    const itemId = Date.now(); // Use timestamp as ID
    // Correctly construct itemRef using userId directly
    const itemRef = ref(database, `todos/${userId}/${itemId}`); 

    const newItem = {
        id: itemId,
        activity: activityText,
        priority: priorityValue,
        completed: false,
    };

    saveItemToFirebase(itemRef, newItem);

    activityInput.value = '';
    priorityInput.value = '';
    activityInput.focus();
}

function renderList() {
    if (!todoList) return; // Check if element exists
    const sortedItems = sortItems(currentItems);
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
    if (!todoList) return;
    const li = document.createElement('li');
    li.classList.add('todo-item');
    li.dataset.id = item.id;
    if (item.completed) {
        li.classList.add('completed');
    }

    // Use the stored itemIndex for numbering - REMOVED
    li.innerHTML = `
        <!-- <span class="todo-no">${item.itemIndex || '-'}</span> --> <!-- Removed No. -->
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
    if (!todosRef) return;
    const target = event.target;
    const li = target.closest('li.todo-item');
    if (!li) return; // Ensure we are clicking within a list item

    const itemId = li.dataset.id;

    if (target.classList.contains('complete-checkbox')) {
        toggleItemCompletion(itemId);
    }

    if (target.classList.contains('delete-btn')) {
        itemToDelete = li;
        deleteCallback = () => {
            removeItemFromFirebase(itemId);
        };
        showConfirmModal();
    }
}

async function toggleItemCompletion(itemId) {
    // Ensure user is logged in
    const user = auth.currentUser;
    if (!user || !itemId) {
        console.error("User not logged in or itemId missing for toggle");
        return;
    }
    const userId = user.uid;
    const itemRef = ref(database, `todos/${userId}/${itemId}`); // Use userId directly
    try {
        const snapshot = await get(itemRef);
        if (snapshot.exists()) {
            const item = snapshot.val();
            const updates = { ...item, completed: !item.completed };
            await set(itemRef, updates);
        } else {
            console.error("Item not found for update:", itemId);
        }
    } catch (error) {
        console.error("Error updating item completion:", error);
        alert('항목 업데이트 중 오류가 발생했습니다.');
    }
}

function updateProgress() {
    if (!progressBar || !progressPercentage) return;
    const totalItems = currentItems.length;
    if (totalItems === 0) {
        progressBar.style.width = '0%';
        progressPercentage.textContent = '0%';
        return;
    }
    const completedItems = currentItems.filter(item => item.completed).length;
    const percentage = Math.round((completedItems / totalItems) * 100);
    progressBar.style.width = `${percentage}%`;
    progressPercentage.textContent = `${percentage}%`;
}

// --- Modal Functions (Unchanged) ---
function showConfirmModal() {
    if (!confirmModal || !confirmYesBtn || !confirmNoBtn) return;
    confirmModal.style.display = 'flex';
    confirmYesBtn.addEventListener('click', handleConfirmYes);
    confirmNoBtn.addEventListener('click', handleConfirmNo);
}

function hideConfirmModal() {
    if (!confirmModal || !confirmYesBtn || !confirmNoBtn) return;
    confirmModal.style.display = 'none';
    itemToDelete = null;
    deleteCallback = null;
    confirmYesBtn.removeEventListener('click', handleConfirmYes);
    confirmNoBtn.removeEventListener('click', handleConfirmNo);
}

function handleConfirmYes() {
    if (deleteCallback) {
        deleteCallback();
    }
    hideConfirmModal();
}

function handleConfirmNo() {
    hideConfirmModal();
}

// --- Firebase Database Functions (Modified for user-specific path) ---

function setupFirebaseListener() {
    if (!todosRef) {
        console.log("Cannot set up listener, user not logged in or ref not set.");
        return;
    }
    console.log("Setting up Firebase listener for:", todosRef.key);
    // Detach previous listener before attaching a new one
    if (firebaseListenerUnsubscribe) {
        firebaseListenerUnsubscribe();
        console.log("Detached previous Firebase listener");
    }

    firebaseListenerUnsubscribe = onValue(todosRef, (snapshot) => {
        console.log("Firebase data received:", snapshot.val()); // Log raw data
        const data = snapshot.val();
        if (data) {
            currentItems = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            console.log("Processed currentItems:", currentItems); // Log processed array
        } else {
            currentItems = [];
            console.log("No data found in Firebase, currentItems set to empty array.");
        }
        renderList();
    }, (error) => {
        console.error("Firebase read failed:", error);
        alert('데이터를 불러오는 데 실패했습니다.');
        currentItems = [];
        renderList();
    });
}

async function saveItemToFirebase(itemRef, item) {
    if (!todosRef) return;
   try {
       await set(itemRef, item);
   } catch (error) {
       console.error("Error saving item to Firebase:", error);
       alert('항목 저장 중 오류가 발생했습니다.');
   }
}

async function removeItemFromFirebase(itemId) {
    // Ensure user is logged in
    const user = auth.currentUser;
    if (!user || !itemId) {
        console.error("User not logged in or itemId missing for remove");
        return;
    }
    const userId = user.uid;
    const itemRef = ref(database, `todos/${userId}/${itemId}`); // Use userId directly
    try {
        await remove(itemRef);
        console.log("Item removed successfully:", itemId); // Add success log
    } catch (error) {
        console.error("Error removing item from Firebase:", error);
        alert('항목 삭제 중 오류가 발생했습니다.');
    }
}

// Removed getItemsFromLocalStorage, saveItemToLocalStorage, removeItemFromLocalStorage
// Removed itemIndex migration logic