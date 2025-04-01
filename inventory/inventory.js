document.addEventListener("DOMContentLoaded", function() {
  const urlParams = new URLSearchParams(window.location.search);
  const trainerName = urlParams.get("trainer");

  if (!trainerName) {
      document.body.innerHTML = "<h1>Trainer not found</h1>";
      return;
  }

  // Fetch the inventory data for the trainer
  fetch("../inventory/inventory.json")
      .then(response => response.json())
      .then(inventoryData => {
          if (inventoryData[trainerName]) {
              const trainerInventory = inventoryData[trainerName];
              const inventoryList = document.getElementById("inventory-list");
              const categoryButtons = document.getElementById("category-buttons");

              // Create buttons for each category
              for (const category in trainerInventory) {
                const button = document.createElement("button");
                button.textContent = category;
                button.classList.add("category-button"); // Add a specific class here
                button.onclick = () => displayCategoryItems(category, trainerInventory[category]);

                categoryButtons.appendChild(button);
              }

                // Function to display items of the clicked category
                function displayCategoryItems(category, items) {
                    // Clear the current inventory display
                    inventoryList.innerHTML = "";

                    // Display the category heading
                    const categoryHeading = document.createElement("h2");
                    categoryHeading.textContent = category;
                    inventoryList.appendChild(categoryHeading);

                    // Loop through the items in each category and display them if quantity > 0
                    for (const itemName in items) {
                        const itemQuantity = items[itemName];

                        if (itemQuantity > 0) { // Only display if quantity is greater than 0
                            const listItem = document.createElement("li");
                            listItem.innerHTML = `<strong>${itemName}</strong> - Quantity: ${itemQuantity}`;
                            inventoryList.appendChild(listItem);
                        }
                    }

                    // If no items are displayed, show a message
                    if (inventoryList.children.length === 1) { // Only category heading is present
                        const noItemsMessage = document.createElement("p");
                        noItemsMessage.textContent = "No items available in this category.";
                        inventoryList.appendChild(noItemsMessage);
                    }
                }

              // Show the first category by default (you can change this as needed)
              const firstCategory = Object.keys(trainerInventory)[0];
              displayCategoryItems(firstCategory, trainerInventory[firstCategory]);

          } else {
              document.body.innerHTML = "<h1>No inventory found for this trainer</h1>";
          }
      })
      .catch(error => {
          console.error("Error loading inventory data:", error);
          document.body.innerHTML = "<h1>Error loading inventory data</h1>";
      });
});

// Back to Trainer Profile function
function goBack() {
  const urlParams = new URLSearchParams(window.location.search);
  const trainerName = urlParams.get("trainer");
  window.location.href = `../player/player.html?trainer=${trainerName}`;
}
