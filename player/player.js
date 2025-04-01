document.addEventListener("DOMContentLoaded", function() {
  const urlParams = new URLSearchParams(window.location.search);
  const trainerName = urlParams.get("trainer");
  const role = localStorage.getItem("role");

  // Fetch both players and pokemon data
  Promise.all([
      fetch("players.json").then(response => response.json()),
      fetch("../pokemon/pokemon.json").then(response => response.json())
  ])
  .then(([players, pokemonData]) => {
      if (players[trainerName]) {
          const player = players[trainerName];
          
          // Display trainer information
          document.getElementById("trainer-info").innerHTML = `
              <p><strong>Trainer Name:</strong> ${trainerName}</p>
              <p><strong>Player Name:</strong> ${player.playerName}</p>
              <p><strong>Level:</strong> ${player.level}</p>
              <p><strong>Class:</strong> ${player.class}</p>
              <p><strong>Advanced Class 1:</strong> ${player.advancedClass1 || "None"}</p>
              <p><strong>Advanced Class 2:</strong> ${player.advancedClass2 || "None"}</p>
              <p><strong>Advanced Class 3:</strong> ${player.advancedClass3 || "None"}</p>
              <p><strong>Origin:</strong> ${player.origin}</p>
          `;

          // Display stats
          document.getElementById("stats").innerHTML = `
              <p><strong>Attack:</strong> ${player.stats.attack}</p>
              <p><strong>Defense:</strong> ${player.stats.defense}</p>
              <p><strong>Special Attack:</strong> ${player.stats.specialAttack}</p>
              <p><strong>Special Defense:</strong> ${player.stats.specialDefense}</p>
              <p><strong>Speed:</strong> ${player.stats.speed}</p>
          `;

          // Display money
          document.getElementById("money").textContent = `Money: ${player.money}`;

          // Display Pokémon team info
          document.getElementById("pokemon-team").innerHTML = player.pokemonTeam.map(pokemon => {
              const pokemonInfo = pokemonData[pokemon.name]; // Get the detailed info for the Pokémon
              if (pokemonInfo) {
                  const types = pokemonInfo.type2 ? `${pokemonInfo.type1}/${pokemonInfo.type2}` : pokemonInfo.type1;

                  return `
                      <p><strong><a href="../pokemon/pokemon.html?name=${encodeURIComponent(pokemon.name)}">${pokemon.name}</a></strong> (${pokemonInfo.species}) - ${types}</p>
                  `;
              }
              return `<p><strong>${pokemon.name}</strong> (Details not found)</p>`;
          }).join('');
      } else {
          document.body.innerHTML = "<h1>Trainer not found</h1>";
      }
  })
  .catch(error => console.error("Error loading player data:", error));
});

function goToInventory() {
  console.log("redirection should work")
  window.location.href = "../inventory/inventory.html?trainer=" + new URLSearchParams(window.location.search).get("trainer");
}

function goToComputer() {
    window.location.href = "../computer/computer.html?trainer=" + new URLSearchParams(window.location.search).get("trainer");
  }
