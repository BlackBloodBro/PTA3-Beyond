fetch("../data/login.json")
    .then(response => response.json())
    .then(users => {
        document.getElementById("loginForm").addEventListener("submit", function(event) {
            event.preventDefault();
            const trainer = document.getElementById("trainer").value;
            const password = document.getElementById("password").value;
            
            if (users[trainer] && users[trainer].password === password) {
                console.log("Login successful for", trainer);
                
                // Check if the user is a GameMaster
                if (users[trainer].role === "gamemaster") {
                    localStorage.setItem("role", "gamemaster");
                    alert("Welcome, GameMaster!");
                    window.location.href = "../gamemaster/gamemaster.html?role=gamemaster"; // Redirect to the GameMaster dashboard
                } else {
                    localStorage.setItem("role", "player");
                    alert("Welcome, " + trainer + "!");
                    window.location.href = "../player/player.html?trainer=" + encodeURIComponent(trainer); // Normal player login
                }
            } else {
                console.log("Login failed for", trainer);
                alert("Invalid trainer name or password.");
            }
        });
    })
    .catch(error => console.error("Error loading trainer data:", error));
