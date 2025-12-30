// Firebase 설정
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDioYtc2VVN5erDiv_Tp-VdG4Zg1P9fm3k",
    authDomain: "kooksun-hr.firebaseapp.com",
    databaseURL: "https://kooksun-hr-default-rtdb.firebaseio.com",
    projectId: "kooksun-hr",
    storageBucket: "kooksun-hr.firebasestorage.app",
    messagingSenderId: "403254476989",
    appId: "1:403254476989:web:c05fb023e550516037b7d4",
    measurementId: "G-L4WYFHYYGF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
const auth = getAuth(app);

// Data Paths (keeping the string constants for reference if needed, but we will mostly use SDK refs)
const RTDB_BASE_URL = "lostark/character_groups";
const TODO_BASE_URL = "lostark/todo_catalog";
const CHARACTER_TODO_STATE_BASE_URL = "lostark/character_todo_state";
const EXPEDITION_TODO_BASE_URL = "lostark/expedition_todo_catalog";
const EXPEDITION_TODO_STATE_BASE_URL = "lostark/expedition_todo_state";

export { auth, database, RTDB_BASE_URL, TODO_BASE_URL, CHARACTER_TODO_STATE_BASE_URL, EXPEDITION_TODO_BASE_URL, EXPEDITION_TODO_STATE_BASE_URL };
