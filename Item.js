const express = require("express");
const axios = require("axios");
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
    const products = data.products.map((item) => item.name);
    return { products };
  } catch (error) {
    return { error: `Error fetching GHL menu: ${error.message}` };
  }
}

// Levenshtein Distance
function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, () => []);
  for (let i = 0; i <= b.length; i++) dp[i][0] = i;
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] =
        b[i - 1] === a[j - 1]
          ? dp[i - 1][j - 1]
          : Math.min(dp[i - 1][j - 1] + 1, dp[i][j - 1] + 1, dp[i - 1][j] + 1);
    }
  }
  return dp[b.length][a.length];
}

function normalize(str) {
    return str.toLowerCase().replace(/[^a-z\s]/g, "").trim();
  }
  

function extractItemsFromOrder(orderString) {
  const cleanedOrder = orderString.toLowerCase().replace(/\d+/g, "");
  return cleanedOrder
    .split(/and|,|\+|&/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getBestMatch(input, menuItems) {
    const normInput = normalize(input);
    let bestMatch = null;
    let bestDistance = Infinity;
  
    const threshold =
      normInput.length <= 4 ? 1 :
      normInput.length <= 7 ? 2 :
      normInput.length <= 10 ? 3 : 4;
  
    for (const item of menuItems) {
      const normItem = normalize(item);
  
      // Exact match
      if (normInput === normItem) {
        return { match: item, available: true };
      }
  
      const dist = levenshtein(normInput, normItem);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = item;
      }
    }
  
    // ✅ Accept fuzzy match if within threshold, regardless of word count
    if (bestDistance <= threshold && normInput.length > 2) {
      return { match: bestMatch, available: true };
    }
  
    return {
      match: null,
      available: false,
    };
  }
function getSuggestions(input, list) {
    const normInput = normalize(input);
  
    // First: substring matches (even if partial)
    const substringMatches = list.filter(item => {
      const normItem = normalize(item);
      return normItem.includes(normInput) || normInput.includes(normItem);
    });
  
    if (substringMatches.length > 0) {
      return substringMatches.slice(0, 3); // return top 3 substring matches
    }
  
    // Fallback: fuzzy matching with Levenshtein distance
    return list
      .map(item => ({
        item,
        score: levenshtein(normInput, normalize(item))
      }))
      .filter(obj => obj.score <= 4) // tweakable threshold
      .sort((a, b) => a.score - b.score)
      .map(obj => obj.item)
      .slice(0, 3);
  }
  

// Route
app.post("/check_order", async (req, res) => {
  const { order_string } = req.body;
  if (!order_string) {
    return res
      .status(400)
      .json({ error: "Missing order_string in request body" });
  }

  const { products, error } = await fetchGhlMenu();
  if (error) return res.status(500).json({ error });

  const orderItems = extractItemsFromOrder(order_string);
  const results = [];

  orderItems.forEach((item) => {
    const { match, available } = getBestMatch(item, products);
    if (available) {
      results.push({ input: item, matchedItem: match, available: true });
    } else {
      results.push({
        input: item,
        matchedItem: null,
        available: false,
        suggestions: getSuggestions(item, products),
      });
    }
  });

  return res.json({
    status: "success",
    message: "Checked order items",
    results,
  });
});

// Start server
app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});
