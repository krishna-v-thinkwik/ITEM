const express = require("express");
const axios = require("axios");
const stringSimilarity = require("string-similarity");
const app = express();
const port = process.env.PORT || 5000; // Use Render's port

app.use(express.json());

// Replace with your actual API key and location ID (Store in environment variables on Render)
const GHL_API_KEY = "pit-a183822b-0996-4d1a-b3a8-5dbb184f6c3b";
const LOCATION_ID = "f4J9w7Xpu7w4PftyYw2j";
const GHL_API_URL = `https://services.leadconnectorhq.com/products/?locationId=${LOCATION_ID}`;

const HEADERS = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  Accept: "application/json",
};

async function fetchGhlMenu() {
  try {
    const response = await axios.get(GHL_API_URL, { headers: HEADERS });
    const data = response.data;
    const menuSet = new Set(data.products.map((item) => item.name.toLowerCase()));
    return { menuSet, products: data.products.map((item) => item.name.toLowerCase()) };
  } catch (error) {
    return { error: `Error fetching GHL menu: ${error.message}` };
  }
}

function extractItemsFromOrder(orderString) {
  const cleanedOrder = orderString.replace(/\d+/g, "").toLowerCase();
  return new Set(cleanedOrder.split(/\band\b|\+|,/).map((item) => item.trim()));
}

function suggestSimilarItems(item, menuItems) {
  const matches = stringSimilarity.findBestMatch(item, menuItems);
  return matches.ratings
    .filter((match) => match.rating > 0.3) // Adjust threshold as needed
    .map((match) => match.target);
}

function getCategorySuggestions(item, menuItems) {
  const category = item.split(" ").pop(); // Extract last word like "pakora", "naan"
  return menuItems.filter(menuItem => menuItem.includes(category));
}

app.post("/check_order", async (req, res) => {
  const { order_string } = req.body;
  if (!order_string) {
    return res.status(400).json({ error: "Missing order_string in request body" });
  }

  const { menuSet, products } = await fetchGhlMenu();
  if (!menuSet) {
    return res.status(500).json({ error: "Failed to fetch menu" });
  }

  const orderItems = extractItemsFromOrder(order_string);
  const missingItems = [...orderItems].filter((item) => !menuSet.has(item));

  if (missingItems.length > 0) {
    const suggestions = missingItems.map((item) => {
      const suggestedItems = getCategorySuggestions(item, products).length > 0 
        ? getCategorySuggestions(item, products) 
        : suggestSimilarItems(item, products);
      
      return `Sorry, ${item} is not in our menu! ${suggestedItems.length > 0 ? `We have ${suggestedItems.join(", ")}. Would you like to order it?` : ""}`;
    });

    return res.status(400).json({ message: suggestions.join(" ") });
  } else {
    return res.json({ status: "success", message: "All items are available" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
