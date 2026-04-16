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
      console.error("SAVE ERROR:", err);
      res.status(500).json({error: err.toString()});
    });
});


// Save custom tags from recipe to Firestore
function saveCustomTags(tags) {
  const seen = {};
  tags.forEach(tag => {
    if (!seen[tag]) {
      seen[tag] = true;
      // Save to appropriate category based on tag
      let category = 'general';
      const proteins = ['Beef', 'Chicken', 'Eggs', 'Fish', 'Pork'];
      const vegetables = ['Broccoli', 'Carrots', 'Garlic', 'Leafy Greens', 'Onions'];
      const fruits = ['Apples', 'Berries', 'Lemons', 'Limes', 'Oranges'];
      const dairy = ['Butter', 'Cheese', 'Cream', 'Milk', 'Yogurt'];
      const nuts = ['Almonds', 'Peanuts', 'Pecans', 'Walnuts'];
      
      if (proteins.includes(tag)) category = 'proteins';
      else if (vegetables.includes(tag)) category = 'vegetables';
      else if (fruits.includes(tag)) category = 'fruits';
      else if (dairy.includes(tag)) category = 'dairy';
      else if (nuts.includes(tag)) category = 'nuts';
      
      const docRef = db.collection('customTags').doc(category);
      docRef.get().then(doc => {
        let existing = doc.exists ? (doc.data().tags || []) : [];
        if (!existing.includes(tag)) {
          existing.push(tag);
          existing.sort();
          docRef.set({tags: existing});
        }
      });
    }
  });
}

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
  
  // Save custom tags to Firestore
  if (data.tags && Array.isArray(data.tags)) {
    saveCustomTags(data.tags);
  }
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
  let author = data.author;
  if (data.url) {
    try {
      const u = new URL(data.url);
      author = u.hostname.replace('www.', '');
    } catch(e) {}
  }
  data.author = author;
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
      console.error("SAVE ERROR:", err);
      res.status(500).json({error: err.toString()});
    });
});

exports.saveCustomTags = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  const data = req.body;
  const tags = data.tags || [];
  const category = data.category || "general";
  
  if (!tags.length) {
    res.status(400).json({error: "No tags provided"});
    return;
  }
  
  db = admin.firestore();
  const batch = db.batch();
  const tagRef = db.collection("customTags").doc(category);
  
  db.collection("customTags").doc(category).get()
    .then(doc => {
      let existingTags = [];
      if (doc.exists) {
        existingTags = doc.data().tags || [];
      }
      // Add new unique tags
      const newTags = tags.filter(t => !existingTags.includes(t));
      const allTags = [...existingTags, ...newTags];
      
      batch.set(tagRef, {tags: allTags, updated: admin.firestore.FieldValue.serverTimestamp()});
      return batch.commit();
    })
    .then(() => {
      res.json({success: true, added: tags.length});
    })
    .catch(err => {
      console.error("SAVE TAGS ERROR:", err);
      res.status(500).json({error: err.toString()});
    });
});

exports.getCustomTags = functions.https.onRequest((req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  
  const category = req.query.category || "general";
  
  db = admin.firestore();
  db.collection("customTags").doc(category).get()
    .then(doc => {
      if (doc.exists) {
        res.json({tags: doc.data().tags || []});
      } else {
        res.json({tags: []});
      }
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

// Decode HTML entities
function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, function(m, code) {
      return String.fromCharCode(code);
    });
}
  
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
          ingredients = ingredients.map(i => decodeHtmlEntities(String(i).trim())).filter(i => i);
        }
        
        let instructions = recipe.recipeInstructions || '';
        if (typeof instructions === 'object' && instructions !== null) {
          // HowToStep or HowToSection
          if (instructions['@type'] === 'HowToStep') {
            instructions = decodeHtmlEntities(instructions.text) || '';
          } else if (instructions['@type'] === 'HowToSection') {
            const steps = instructions.itemListElement || [];
            instructions = steps.map(s => s.itemListElement ? s.itemListElement.map(ss => decodeHtmlEntities(ss.text || ss)).join('\n') : decodeHtmlEntities(s.text || s)).join('\n');
          } else if (Array.isArray(instructions)) {
            // List of steps
            instructions = instructions.map((s, idx) => {
              if (typeof s === 'string') return s;
              if (s.text) return decodeHtmlEntities(s.text);
              if (s['@type'] === 'HowToStep') return decodeHtmlEntities(s.text) || '';
              return String(idx + 1) + '. ' + JSON.stringify(s);
            }).join('\n');
          }
        }
        
        res.json({
          recipe: {
          author: (function() { try { return new URL(url).hostname.replace('www.', ''); } catch(e) { return decodeHtmlEntities((typeof recipe.author === "object" && recipe.author.name) ? recipe.author.name : (recipe.author || "")); } })(),
            title: decodeHtmlEntities((recipe.name || '').trim()),
            description: decodeHtmlEntities((recipe.description || '').trim()),
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
          author: (function() { try { return new URL(url).hostname.replace('www.', ''); } catch(e) { return (typeof recipe.author === "object" && recipe.author.name) ? recipe.author.name : (recipe.author || ""); } })(),
          title: title.trim(),
          description: decodeHtmlEntities(desc.trim()),
          ingredients: ing.length ? ing : [],
          instructions: inst.length ? inst.join('\n') : '',
          image: $('meta[property="og:image"]').attr('content') || '',
          sourceUrl: url
        }
      });
    })
    .catch(function(err) {
      res.json({error: "Could not fetch URL: " + err.message});
    });
});
