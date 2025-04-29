// scripts/login.js

// On page load: set up event listeners for 'login' and 'create new user' forms
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const createAccountForm = document.getElementById('createAccountForm');

    // If login form exists, set it up
    if (loginForm) {
        setupLoginForm();
    }

    // If create account form exists, set it up
    if (createAccountForm) {
        setupCreateAccountForm();
    }
});

// Function: Set up login form submission
function setupLoginForm() {
    const form = document.getElementById('loginForm');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent form from refreshing page

        // Get username and password input values
        const username = document.getElementById('trainer').value;
        const password = document.getElementById('password').value;

        try {
            // Try to log in user with provided credentials
            const response = await loginUser(username, password);

            if (response.ok) {
                const data = await response.json();
                redirectUserByRole(data.role); // Redirect based on user role
            } else {
                const errorData = await response.json();
                alert(`Login failed: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error logging in:', error);
            alert('An error occurred. Please try again.');
        }
    });
}

// Function: Set up create account form submission
function setupCreateAccountForm() {
    const form = document.getElementById('createAccountForm');

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent form from refreshing page

        // Get input values for new account
        const username = document.getElementById('newTrainer').value;
        const password = document.getElementById('newPassword').value;
        const role = document.getElementById('role').value;

        try {
            // Try to create a new user with the input values
            const response = await createUser(username, password, role);

            if (response.ok) {
                const data = await response.json();
                alert(`Account created! Your ID is ${data.id}`);
                form.reset(); // Clear form fields after success
            } else {
                const errorData = await response.json();
                alert(`Failed to create account: ${errorData.error}`);
            }
        } catch (error) {
            console.error('Error creating account:', error);
            alert('An error occurred. Please try again.');
        }
    });
}

// Function: Send new user data to server to create a user in the database
async function createUser(username, password, role) {
    return fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, role })
    });
}

// Function: Send login request to server with username and password
async function loginUser(username, password) {
    return fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
}

// Function: Redirect user to correct page based on their role (player or gamemaster)
function redirectUserByRole(role) {
    if (role === 'player') {
        window.location.href = '/player/player.html';
    } else if (role === 'gamemaster') {
        window.location.href = '/gamemaster/gamemaster.html';
    } else {
        alert('Unknown role!');
    }
}
