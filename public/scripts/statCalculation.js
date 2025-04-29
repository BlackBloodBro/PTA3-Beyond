export function calculateStats(pokemon) {
  // Define nature effects
  const natureEffects = {
    Lonely: { increase: "attack", decrease: "defense" },
    Brave: { increase: "attack", decrease: "speed" },
    Adamant: { increase: "attack", decrease: "specialAttack" },
    Naughty: { increase: "attack", decrease: "specialDefense" },
    Bold: { increase: "defense", decrease: "attack" },
    Relaxed: { increase: "defense", decrease: "speed" },
    Impish: { increase: "defense", decrease: "specialAttack" },
    Lax: { increase: "defense", decrease: "specialDefense" },
    Timid: { increase: "speed", decrease: "attack" },
    Hasty: { increase: "speed", decrease: "defense" },
    Jolly: { increase: "speed", decrease: "specialAttack" },
    Naive: { increase: "speed", decrease: "specialDefense" },
    Modest: { increase: "specialAttack", decrease: "attack" },
    Mild: { increase: "specialAttack", decrease: "defense" },
    Quiet: { increase: "specialAttack", decrease: "speed" },
    Rash: { increase: "specialAttack", decrease: "specialDefense" },
    Calm: { increase: "specialDefense", decrease: "attack" },
    Gentle: { increase: "specialDefense", decrease: "defense" },
    Sassy: { increase: "specialDefense", decrease: "speed" },
    Careful: { increase: "specialDefense", decrease: "specialAttack" },
  };

  // Calculate base stats
  let stats = {
    hp: parseInt(pokemon.baseHitpoints) + (parseInt(pokemon.evHitpoints) * 6),
    attack: parseInt(pokemon.baseAttack) + parseInt(pokemon.evAttack),
    defense: parseInt(pokemon.baseDefense) + parseInt(pokemon.evDefense),
    specialAttack: parseInt(pokemon.baseSpecialAttack) + parseInt(pokemon.evSpecialAttack),
    specialDefense: parseInt(pokemon.baseSpecialDefense) + parseInt(pokemon.evSpecialDefense),
    speed: parseInt(pokemon.baseSpeed) + parseInt(pokemon.evSpeed)
  };

  // Apply nature effects if the Pokémon has a recognized nature
  const nature = pokemon.nature.trim(); // Ensure no extra spaces
  if (natureEffects[nature]) {
      const { increase, decrease } = natureEffects[nature];
      stats[increase] += 1; // Add 1 to the boosted stat
      stats[decrease] -= 1; // Subtract 1 from the weakened stat
  }

  return stats;
}
