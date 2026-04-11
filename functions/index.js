const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

exports.getRecipe = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  const recipeId = req.query.id || (req.body && req.body.id);
  if (!recipeId) {
    res.status(400).json({error: "No recipe ID"});
    return;
  }
  
  db = admin.firestore();
  db.collection("recipes").doc(recipeId).get()
    .then(doc => {
      if (!doc.exists) {
        res.status(404).json({error: "Recipe not found"});
        return;
      }
      res.json(doc.data());
    })
    .catch(err => {
      res.status(500).json({error: err.toString()});
    });
});

exports.saveRecipe = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  if (req.method !== "POST") {
    res.status(405).json({error: "Method not allowed"});
    return;
  }
  
  const data = req.body;
  if (!data || !data.title) {
    res.status(400).json({error: "Missing title"});
    return;
  }
  
  db = admin.firestore();
  db.collection("recipes").add(data)
    .then(docRef => {
      res.json({id: docRef.id});
    })
    .catch(err => {
      res.status(500).json({error: err.toString()});
    });
});

exports.importRecipe = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  const url = req.body && req.body.url;
  if (!url) {
    res.status(400).json({error: "Missing URL"});
    return;
  }
  
  // Use axios to fetch the page and extract recipe data
  const axios = require('axios');
  
  axios.get(url, { timeout: 10000 })
    .then(function(html) {
      const cheerio = require('cheerio');
      const $ = cheerio.load(html.data);
      
      // Try to find JSON-LD schema
      let recipe = null;
      $('script[type="application/ld+json"]').each(function(i, el) {
        try {
          const json = JSON.parse($(el).html());
          if (json['@type'] === 'Recipe' || (Array.isArray(json) && json.find(function(x){return x['@type'] === 'Recipe'}))) {
            recipe = Array.isArray(json) ? json.find(function(x){return x['@type'] === 'Recipe'}) : json;
          }
        } catch(e) {}
      });
      
      // If no JSON-LD, try to extract from meta tags
      if (!recipe) {
        const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Imported Recipe';
        const desc = $('meta[property="og:description"]').attr('content') || '';
        
        recipe = {
          title: title.trim(),
          description: desc.trim(),
          ingredients: [],
          instructions: ''
        };
        
        // Try to find ingredients
        $('[class*="ingredient"], .ingredients, [itemprop="recipeIngredient"]').each(function(i, el) {
          const text = $(el).text().trim();
          if (text) recipe.ingredients.push(text);
        });
        
        // Try to find instructions
        $('[class*="instruction"], .instructions, [itemprop="recipeInstructions"]').each(function(i, el) {
          const text = $(el).text().trim();
          if (text && !recipe.instructions) recipe.instructions = text;
        });
      }
      
      if (!recipe) {
        res.json({error: "Could not extract recipe from this site"});
        return;
      }
      
      // Add image if found
      const img = $('meta[property="og:image"]').attr('content') || $('meta[name="twitter:image"]').attr('content') || $('meta[itemprop="image"]').attr('content') || '';
      if (img) recipe.image = img;
      
      // Add author from domain
      try {
        const urlObj = new URL(url);
        recipe.author = urlObj.hostname.replace('www.', '');
      } catch(e) {}
      
      res.json({recipe: recipe});
    })
    .catch(function(err) {
      res.json({error: "Could not fetch URL: " + err.message});
    });
});
