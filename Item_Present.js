const express = require("express");
const axios = require("axios");
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
    return new Set(data.products.map((item) => item.name.toLowerCase()));
  } catch (error) {
    return { error: `Error fetching GHL menu: ${error.message}` };
  }
}

function extractItemsFromOrder(orderString) {
  const cleanedOrder = orderString.replace(/\d+/g, "").toLowerCase();
  return new Set(cleanedOrder.split(/\band\b|\+|,/).map((item) => item.trim()));
}

app.post("/check_order", async (req, res) => {
  const { order_string } = req.body;
  if (!order_string) {
    return res.status(400).json({ error: "Missing order_string in request body" });
  }

  const ghlMenu = await fetchGhlMenu();
  if (ghlMenu.error) {
    return res.status(500).json(ghlMenu);
  }

  const orderItems = extractItemsFromOrder(order_string);
  const missingItems = [...orderItems].filter((item) => !ghlMenu.has(item));

  if (missingItems.length > 0) {
    return res.status(400).json({ message: `${missingItems.join(", ")} is not in our menu` });
  } else {
    return res.json({ status: "success", message: "All items are available" });
  }
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
