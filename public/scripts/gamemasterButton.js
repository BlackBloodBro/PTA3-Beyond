document.addEventListener("DOMContentLoaded", function () {
  const role = localStorage.getItem("role");

  // Check if the role is gamemaster
  if (role === "gamemaster") {
      // Create the button dynamically
      const gamemasterButton = document.createElement("button");
      gamemasterButton.id = "gamemasterButton";
      gamemasterButton.classList.add("topButton");
      gamemasterButton.textContent = "Go to GameMaster Dashboard";
      gamemasterButton.onclick = goToGameMaster; // Assign the function to the button

      // Find a container to insert the button
      const playerContainer = document.querySelector(".player-container");
      const pokemonContainer = document.querySelector(".pokemon-container");

      if (playerContainer) {
          playerContainer.insertBefore(gamemasterButton, playerContainer.firstChild);
      } else if (pokemonContainer) {
          pokemonContainer.insertBefore(gamemasterButton, pokemonContainer.firstChild);
      }
  }
});

function goToGameMaster() {
  window.location.href = "../gamemaster/gamemaster.html"; // Adjust path for GameMaster page
}
