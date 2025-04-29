import { calculateStats } from '../scripts/statCalculation.js';

document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const pokemonName = urlParams.get("name");

    Promise.all([
        fetch("pokemon.json").then(response => response.json()),
        fetch("../data/moves.json").then(response => response.json()),
        fetch("../data/passives.json").then(response => response.json())
    ])
    .then(([pokemonData, movesData, passivesData]) => {
        if (pokemonData[pokemonName]) {
            const pokemon = pokemonData[pokemonName];
            const stats = calculateStats(pokemon);

                if (pokemon.currentHitpoints === undefined) {
                    pokemon.currentHitpoints = stats.hp;
                }

                function updateCurrentHP(hpChange) {
                    pokemon.currentHitpoints = Math.min(stats.hp, Math.max(0, pokemon.currentHitpoints + hpChange));
                    document.getElementById("hp-display").innerHTML = `<p><strong>HP:</strong> ${pokemon.currentHitpoints} / ${stats.hp}</p>`;
                    saveUpdatedHP(pokemonName, pokemon.currentHitpoints);
                }

                document.getElementById("pokemon-info").innerHTML = `
                    <p><strong>Species:</strong> ${pokemon.species}</p>
                    <p><strong>Type:</strong> ${pokemon.type1}${pokemon.type2 ? ' / ' + pokemon.type2 : ''}</p>
                    <p><strong>Trainer:</strong> <a href="../player/player.html?trainer=${encodeURIComponent(pokemon.trainer)}">${pokemon.trainer}</a></p>
                    <p><strong>Gender:</strong> ${pokemon.gender}</p>
                    <p><strong>Nature:</strong> ${pokemon.nature}</p>
                    <p><strong>Item:</strong> ${pokemon.heldItem}</p>
                    <p><strong>Obtain Method:</strong> ${pokemon.obtainMethod}</p>
                `;

                document.getElementById("stats").innerHTML = `
                    <p id="hp-display"><strong>HP:</strong> ${pokemon.currentHitpoints} / ${stats.hp}
                    <button class="damageButton" id="damageButton">-</button>
                    <input class="damageInput" type="number" id="hp-change" placeholder="0" />
                    <button class="damageButton" id="healButton">+</button></p>
                    <p><strong>Attack:</strong> ${stats.attack}</p>
                    <p><strong>Defense:</strong> ${stats.defense}</p>
                    <p><strong>Special Attack:</strong> ${stats.specialAttack}</p>
                    <p><strong>Special Defense:</strong> ${stats.specialDefense}</p>
                    <p><strong>Speed:</strong> ${stats.speed}</p>
                `;
                
                // Display Moves with Details
                const movesContainer = document.getElementById("moves");

                pokemon.moves.forEach(move => {
                    const moveDetails = movesData[move];

                    if (moveDetails) {
                        movesContainer.innerHTML += `
                            <div class="card">
                                <p><strong>${moveDetails.name}</strong> (${moveDetails.type})</p>
                                <div class="tooltip">
                                    <p><strong>Range:</strong> ${moveDetails.range}</p>
                                    <p><strong>Modifier:</strong> ${moveDetails.modStat}</p>
                                    <p><strong>Frequency:</strong> ${moveDetails.frequency}</p>
                                    <p><strong>Damage:</strong> ${moveDetails.damage}</p>
                                    <p><strong>Effect:</strong> ${moveDetails.effect}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        movesContainer.innerHTML += `<p>${move} (Details not found)</p>`;
                    }
                });

                // Display Passives with Details
                const passivesContainer = document.getElementById("passives");

                pokemon.passives.forEach(passive => {
                    const passiveDetails = passivesData[passive];

                    if (passiveDetails) {
                        passivesContainer.innerHTML += `
                            <div class="card">
                                <p><strong>${passiveDetails.name}</strong>
                                <div class="tooltip">
                                    <p><strong>Effect:</strong> ${passiveDetails.effect}</p>
                                </div>
                            </div>
                        `;
                    } else {
                        passivesContainer.innerHTML += `<p>${passive} (Details not found)</p>`;
                    }
                });

                // Attach event listeners to buttons
                document.getElementById("damageButton").addEventListener("click", () => {
                    const hpChange = parseInt(document.getElementById("hp-change").value) || 0;
                    updateCurrentHP(-hpChange);
                });

                document.getElementById("healButton").addEventListener("click", () => {
                    const hpChange = parseInt(document.getElementById("hp-change").value) || 0;
                    updateCurrentHP(hpChange);
                });

            } else {
                document.body.innerHTML = "<h1>Pokémon not found</h1>";
            }
        })
        .catch(error => console.error("Error loading Pokémon data:", error));
});

function saveUpdatedHP(pokemonName, newHP) {
    fetch(`http://localhost:3000/update-hp`, {
        method: "POST",
        body: JSON.stringify({ name: pokemonName, currentHitpoints: newHP }),
        headers: { "Content-Type": "application/json" }
    })
    .then(response => response.json())
    .then(data => console.log("HP updated successfully:", data))
    .catch(error => console.error("Error saving HP:", error));
}

