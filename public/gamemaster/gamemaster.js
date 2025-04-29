document.addEventListener("DOMContentLoaded", function() {
  // Fetching the players data
  fetch("../player/players.json")
      .then(response => response.json())
      .then(players => {
          const playersList = document.getElementById("players-list");
          
          // Create a link for each player
          for (const trainerName in players) {
              const player = players[trainerName];
              const playerLink = document.createElement("a");
              playerLink.href = `../player/player.html?trainer=${encodeURIComponent(trainerName)}`;
              playerLink.textContent = `${trainerName} - ${player.playerName}`;
              playerLink.classList.add("player-link");
              playersList.appendChild(playerLink);
          }
      })
      .catch(error => {
          console.error("Error loading player data:", error);
      });
});
