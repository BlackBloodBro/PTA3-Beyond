const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = 3000;
const POKEMON_FILE = path.join(__dirname, "pokemon", "pokemon.json");

// Middleware
app.use(express.json());
app.use(cors());

// Serve static files from the root
app.use(express.static(__dirname));

// Route to update Pokémon HP
app.post("/update-hp", (req, res) => {
    const { name, currentHitpoints } = req.body;

    fs.readFile(POKEMON_FILE, "utf8", (err, data) => {
        if (err) {
            console.error("Error reading file:", err);
            return res.status(500).json({ error: "Failed to read Pokémon data" });
        }

        let pokemonData;
        try {
            pokemonData = JSON.parse(data);
        } catch (parseErr) {
            console.error("Error parsing JSON:", parseErr);
            return res.status(500).json({ error: "Failed to parse Pokémon data" });
        }

        if (!pokemonData[name]) {
            return res.status(404).json({ error: "Pokémon not found" });
        }

        // Update HP
        pokemonData[name].currentHitpoints = currentHitpoints;

        // Save updated data
        fs.writeFile(POKEMON_FILE, JSON.stringify(pokemonData, null, 2), (err) => {
            if (err) {
                console.error("Error writing file:", err);
                return res.status(500).json({ error: "Failed to update Pokémon data" });
            }

            res.json({ message: "HP updated successfully", pokemon: pokemonData[name] });
        });
    });
});

// Start the server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
