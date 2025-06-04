document.addEventListener("DOMContentLoaded", async () => {
    const userId = localStorage.getItem("user_id");

    if (!userId) {
        alert("Not logged in.");
        window.location.href = "/login.html";
        return;
    }

    try {
        const response = await fetch(`/api/user/${userId}/trainers`);
        if (!response.ok) throw new Error("Failed to fetch trainers");

        const trainers = await response.json();

        const container = document.getElementById("trainer-list");
        trainers.forEach(trainer => {
            const btn = document.createElement("button");
            btn.textContent = trainer.trainer_name;
            btn.onclick = () => {
                // Store trainer ID or name
                localStorage.setItem("trainer_id", trainer.id);
                localStorage.setItem("trainer_name", trainer.trainer_name);
                window.location.href = "/player.html";
            };
            container.appendChild(btn);
        });
    } catch (err) {
        console.error("Error loading trainers:", err);
        alert("Could not load your trainers.");
    }
});
