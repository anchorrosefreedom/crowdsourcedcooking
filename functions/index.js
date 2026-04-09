const functions = require('firebase-functions');
const axios = require('axios');

exports.importRecipe = functions.https.onRequest(async (req, res) => {
  // Add CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  console.log('Function called with:', req.body);
  
  const { url } = req.body;
  
  if (!url) {
    res.status(400).json({ error: 'URL is required' });
    return;
  }

  try {
    console.log('Fetching URL:', url);
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CrowdSourcedCooking/1.0)' },
      timeout: 15000
    });

    const html = response.data;
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    
    console.log('Found JSON-LD:', !!jsonLdMatch);
    
    if (jsonLdMatch) {
      const jsonData = JSON.parse(jsonLdMatch[1]);
      console.log('JSON type:', jsonData['@type']);
      console.log('Has graph:', !!jsonData['@graph']);
      
      // More flexible matching
      let recipe = null;
      if (jsonData['@graph'] && Array.isArray(jsonData['@graph'])) {
        recipe = jsonData['@graph'].find(g => 
          g['@type'] === 'Recipe' || 
          (typeof g['@type'] === 'string' && g['@type'].includes('Recipe'))
        );
      } else if (jsonData['@type'] === 'Recipe') {
        recipe = jsonData;
      }
      
      console.log('Found recipe:', recipe ? recipe.name : 'none');
      
      if (recipe) {
        res.json({
          recipe: {
            title: recipe.name || '',
            description: recipe.description || '',
            ingredients: Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [],
            instructions: typeof recipe.recipeInstructions === 'string' ? recipe.recipeInstructions : 
                         Array.isArray(recipe.recipeInstructions) ? recipe.recipeInstructions.map(s => s.text || s).join('\n') : '',
            image: Array.isArray(recipe.image) ? recipe.image[0] : recipe.image?.url || recipe.image || ''
          }
        });
        return;
      }
    }
    
    res.status(404).json({ error: 'Could not find recipe data' });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});
