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
  
  let data = req.body;
  // Flatten nested recipe if imported
  if (data.recipe) {
    data = { ...data.recipe, ...data };
    delete data.recipe;
  }
  // Ensure ingredients is array
  if (Array.isArray(data.ingredients)) {
    data.ingredients = data.ingredients.map(i => {
      if (typeof i !== 'string') return JSON.stringify(i);
      return i;
    });
  }
  // Flatten instructions into array of steps
  if (typeof data.instructions === 'object') {
    if (data.instructions.text) data.instructions = [data.instructions.text];
    else if (Array.isArray(data.instructions)) {
      data.instructions = data.instructions.map(s => {
        if (typeof s === 'string') return s;
        if (s.text) return s.text;
        if (s['@type'] === 'HowToStep') return s.text || '';
        return '';
      }).filter(s => s);
    } else data.instructions = [];
  } else if (typeof data.instructions === 'string') {
    // Split by newlines or numbered patterns
    data.instructions = data.instructions
      .split(/\n|(?=\d+\.\s)/)
      .map(s => s.replace(/^\d+\.\s*/, '').trim())
      .filter(s => s.length > 5);
  }
  
  // Always use domain as author
  let author = '';
  if (data.url) {
    try {
      const u = new URL(data.url);
      author = u.hostname.replace('www.', '');
    } catch(e) {}
  }
  data.author = ''; // Will be overwritten by domain below
  // Always use domain from sourceUrl if available
  data.author = data.sourceUrl ? new URL(data.sourceUrl).hostname.replace('www.', '') : (data.author || 'Anonymous');
    try {
      data.author = new URL(data.sourceUrl).hostname.replace('www.', '');
    } catch(e) {}
  }
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

  const axios = require('axios');
  const cheerio = require('cheerio');
  
  axios.get(url, { timeout: 10000 })
    .then(function(html) {
      const $ = cheerio.load(html.data);
      let recipe = null;
      
      // Parse JSON-LD properly
      $('script[type="application/ld+json"]').each(function(i, el) {
        try {
          const json = JSON.parse($(el).html());
          
          // Handle @graph format (WordPress Yoast)
          if (json['@graph']) {
            for (const item of json['@graph']) {
              if (item['@type'] === 'Recipe') {
                recipe = item;
                break;
              }
            }
          }
          // Handle direct Recipe
          if (!recipe && json['@type'] === 'Recipe') {
            recipe = json;
          }
          // Handle array of types
          if (!recipe && Array.isArray(json)) {
            recipe = json.find(x => x['@type'] === 'Recipe');
          }
        } catch(e) {}
      });
      
      // Extract clean data from recipe
      if (recipe) {
        let ingredients = recipe.recipeIngredient || [];
        // Join array elements, don't split strings
        if (Array.isArray(ingredients)) {
          // Each element should be a full ingredient line
          ingredients = ingredients.map(i => String(i).trim()).filter(i => i);
        }
        
        let instructions = recipe.recipeInstructions || '';
        if (typeof instructions === 'object' && instructions !== null) {
          // HowToStep or HowToSection
          if (instructions['@type'] === 'HowToStep') {
            instructions = instructions.text || '';
          } else if (instructions['@type'] === 'HowToSection') {
            const steps = instructions.itemListElement || [];
            instructions = steps.map(s => s.itemListElement ? s.itemListElement.map(ss => ss.text || ss).join('\n') : (s.text || s)).join('\n');
          } else if (Array.isArray(instructions)) {
            // List of steps
            instructions = instructions.map((s, idx) => {
              if (typeof s === 'string') return s;
              if (s.text) return s.text;
              if (s['@type'] === 'HowToStep') return s.text || '';
              return String(idx + 1) + '. ' + JSON.stringify(s);
            }).join('\n');
          }
        }
        
        res.json({
          recipe: {
          author: recipe.author || "",
            title: (recipe.name || '').trim(),
            description: (recipe.description || '').trim(),
            ingredients: ingredients,
            instructions: instructions,
            image: (Array.isArray(recipe.image) ? recipe.image[0] : recipe.image) || '',
            sourceUrl: url,
          }
        });
        return;
      }
      
      // Fallback: try clean scraping
      const title = $('meta[property="og:title"]').attr('content') || $('title').text() || 'Imported Recipe';
      const desc = $('meta[property="og:description"]').attr('content') || '';
      
      const ing = [];
      $('[itemprop="recipeIngredient"], .recipe-ingredient, .ingredients li, [class*="ingredient"]').each(function(i, el) {
        const t = $(el).text().trim();
        if (t && t.length > 3 && t.length < 200) ing.push(t);
      });
      
      const inst = [];
      $('[itemprop="recipeInstructions"], .recipe-instruction, .instructions li, [class*="instruction"]').each(function(i, el) {
        const t = $(el).text().trim();
        if (t && t.length > 3) inst.push(t);
      });
      
      res.json({
        recipe: {
          author: recipe.author || "",
          title: title.trim(),
          description: desc.trim(),
          ingredients: ing.length ? ing : [],
          instructions: inst.length ? inst.join('\n') : '',
          image: $('meta[property="og:image"]').attr('content') || ''
        }
      });
    })
    .catch(function(err) {
      res.json({error: "Could not fetch URL: " + err.message});
    });
});
