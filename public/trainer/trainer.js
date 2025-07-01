document.addEventListener("DOMContentLoaded", function() {
  const trainerId = localStorage.getItem("trainer_id");

  // Fetch both players and pokemon data
   fetch(`/api/trainers/${trainerId}`)
    .then(response => response.json())
    .then(trainer => {
      if (trainer.error) {
        document.body.innerHTML = "<h1>Trainer not found</h1>";
        return;
      }

      document.getElementById("trainer-info").innerHTML = `
        <p><strong>Trainer Name:</strong> ${trainer.name}</p>
        <p><strong>Player Name:</strong> ${trainer.player_name}</p>
        <p><strong>Level:</strong> ${trainer.level}</p>
        <p><strong>Class:</strong> ${trainer.class}</p>
        <p><strong>Advanced Class 1:</strong> ${trainer.advanced_class_1 || "None"}</p>
        <p><strong>Advanced Class 2:</strong> ${trainer.advanced_class_2 || "None"}</p>
        <p><strong>Advanced Class 3:</strong> ${trainer.advanced_class_3 || "None"}</p>
        <p><strong>Origin:</strong> ${trainer.origin}</p>
      `;

      document.getElementById("money").textContent = `$${trainer.money}`;
    })
    .catch(err => {
      console.error("Failed to load trainer data:", err);
    });
});

function goToInventory() {
  console.log("redirection should work")
  window.location.href = "../inventory/inventory.html?trainer=" + new URLSearchParams(window.location.search).get("trainer");
}

function goToComputer() {
    window.location.href = "../computer/computer.html?trainer=" + new URLSearchParams(window.location.search).get("trainer");
  }
