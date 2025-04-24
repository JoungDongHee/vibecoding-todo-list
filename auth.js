// Import Firebase Auth functions and the auth service from config
import { auth, database } from './firebase-config.js';
import { 
    createUserWithEmailAndPassword, 
    updateProfile, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
// Import Realtime Database functions
import { ref, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-database.js";

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the signup page
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        const usernameInput = document.getElementById('signup-username');
        const emailInput = document.getElementById('signup-email');
        const passwordInput = document.getElementById('signup-password');
        const passwordConfirmInput = document.getElementById('signup-password-confirm');

        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission

            const username = usernameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const passwordConfirm = passwordConfirmInput.value;

            // Basic validation
            if (!username) {
                alert('사용자 이름을 입력해주세요.');
                return;
            }
            if (password !== passwordConfirm) {
                alert('비밀번호가 일치하지 않습니다.');
                passwordInput.value = '';
                passwordConfirmInput.value = '';
                passwordInput.focus();
                return;
            }
            if (password.length < 6) {
                alert('비밀번호는 6자리 이상이어야 합니다.');
                return;
            }

            try {
                // Create user with email and password
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                // Update user profile with display name
                await updateProfile(user, { displayName: username });

                console.log('회원가입 성공:', user);
                alert('회원가입에 성공했습니다! 로그인 페이지로 이동합니다.');
                window.location.href = 'login.html'; // Redirect to login page

            } catch (error) {
                console.error('회원가입 오류:', error);
                // Provide more specific error messages if needed
                if (error.code === 'auth/email-already-in-use') {
                    alert('이미 사용 중인 이메일 주소입니다.');
                } else if (error.code === 'auth/invalid-email') {
                    alert('유효하지 않은 이메일 형식입니다.');
                } else if (error.code === 'auth/weak-password') {
                    alert('비밀번호가 너무 약합니다. 6자리 이상으로 설정해주세요.');
                } else {
                    alert('회원가입 중 오류가 발생했습니다: ' + error.message);
                }
            }
        });
    }

    // Check if we are on the login page
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const emailInput = document.getElementById('login-email');
        const passwordInput = document.getElementById('login-password');

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevent default form submission

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
                alert('이메일과 비밀번호를 모두 입력해주세요.');
                return;
            }

            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;

                console.log('로그인 성공:', user);

                // --- Add Login Log --- 
                try {
                    const logRef = ref(database, 'login_logs');
                    const logData = {
                        userId: user.uid,
                        email: user.email,
                        displayName: user.displayName || '', // Handle null displayName
                        loginTime: serverTimestamp() // Use Firebase server time
                    };
                    await push(logRef, logData); 
                    console.log('Login log successfully written!');
                } catch (logError) {
                    console.error("Error writing login log:", logError);
                    // Continue even if logging fails, login itself was successful
                }
                // --- End Login Log ---

                alert(`로그인 성공! 환영합니다, ${user.displayName || user.email}님.`);
                // Redirect to the main todo list page
                window.location.href = 'index.html';

            } catch (error) {
                console.error('로그인 오류:', error);
                // Handle specific errors
                if (error.code === 'auth/invalid-email' || 
                    error.code === 'auth/wrong-password' || 
                    error.code === 'auth/user-not-found' || 
                    error.code === 'auth/invalid-credential') {
                    alert('이메일 또는 비밀번호가 잘못되었습니다.');
                } else {
                    alert('로그인 중 오류가 발생했습니다: ' + error.message);
                }
                passwordInput.value = ''; // Clear password field on error
                passwordInput.focus();
            }
        });
    }
}); 