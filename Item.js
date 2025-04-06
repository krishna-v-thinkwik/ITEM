const express = require("express");
const axios = require("axios");
const stringSimilarity = require("string-similarity");
const app = express();
const port = process.env.PORT || 5000;

app.use(express.json());

// Replace with environment variables in production
const GHL_API_KEY = "pit-a183822b-0996-4d1a-b3a8-5dbb184f6c3b";
const LOCATION_ID = "f4J9w7Xpu7w4PftyYw2j";
const GHL_API_URL = `https://services.leadconnectorhq.com/products/?locationId=${LOCATION_ID}`;

const HEADERS = {
  Authorization: `Bearer ${GHL_API_KEY}`,
  Version: "2021-07-28",
  Accept: "application/json",
};

// Fetch menu from GoHighLevel
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

// Extract ordered items
function extractItemsFromOrder(orderString) {
  const cleanedOrder = orderString.replace(/\d+/g, "").toLowerCase();
  return new Set(cleanedOrder.split(/\band\b|\+|,/).map((item) => item.trim()));
}

const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

app.post("/check_order", async (req, res) => {
  const { order_string } = req.body;
  if (!order_string) {
    return res.status(400).json({ error: "Missing order_string in request body" });
  }

  const { products, error } = await fetchGhlMenu();
  if (error) {
    return res.status(500).json({ error });
  }

  const normalizedMenu = products.map(normalize);
  const orderItems = extractItemsFromOrder(order_string);
  const matchedItems = [];

  orderItems.forEach((item) => {
    const normalizedItem = normalize(item);

    // Fuzzy match
    const match = stringSimilarity.findBestMatch(normalizedItem, normalizedMenu).bestMatch;
    const originalMenuItem = products[normalizedMenu.indexOf(match.target)];

    if (match.rating > 0.5) {
      matchedItems.push(originalMenuItem); // Automatically accept match if similarity > 50%
    }
    // If rating is low, we just ignore — no need to mention it
  });

  return res.json({
    status: "success",
    message: "Available items matched from the menu:",
    matchedItems,
  });
});


  

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
