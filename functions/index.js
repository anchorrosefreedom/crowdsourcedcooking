const functions = require('firebase-functions');
const axios = require('axios');

// Recipe Import Cloud Function
exports.importRecipe = functions.https.onCall(async (data, context) => {
  const { url } = data;
  
  if (!url) {
    throw new functions.https.HttpsError('invalid-argument', 'URL is required');
  }

  try {
    // Fetch the webpage
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CrowdSourcedCooking/1.0)'
      },
      timeout: 10000
    });

    const html = response.data;

    // Look for JSON-LD schema.org recipe data
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    
    let recipeData = null;

    if (jsonLdMatch) {
      try {
        const jsonData = JSON.parse(jsonLdMatch[1]);
        
        // Handle arrays (sometimes recipe is in an array)
        const recipes = Array.isArray(jsonData) ? jsonData : [jsonData];
        
        for (const item of recipes) {
          // Check for @type: Recipe or Recipe in @graph
          if (item['@type'] === 'Recipe' || 
              (item['@graph'] && item['@graph'].some(g => g['@type'] === 'Recipe'))) {
            
            // Get the recipe object
            const recipe = item['@type'] === 'Recipe' ? item : 
              item['@graph'].find(g => g['@type'] === 'Recipe');
            
            if (recipe) {
              recipeData = {
                title: recipe.name || '',
                author: recipe.author?.name || recipe.author || '',
                description: recipe.description || '',
                ingredients: Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [],
                instructions: Array.isArray(recipe.recipeInstructions) 
                  ? recipe.recipeInstructions.map(step => {
                      if (typeof step === 'object') return step.text || step.name || '';
                      return step;
                    }).join('\n')
                  : (typeof recipe.recipeInstructions === 'object' ? recipe.recipeInstructions.text || '' : recipe.recipeInstructions || ''),
                prepTime: parseDuration(recipe.prepTime),
                cookTime: parseDuration(recipe.cookTime),
                totalTime: parseDuration(recipe.totalTime),
                servings: parseServings(recipe.recipeYield),
                image: Array.isArray(recipe.image) ? recipe.image[0] : (recipe.image?.url || recipe.image || ''),
                calories: parseInt(recipe.nutrition?.calories) || null,
                protein: parseInt(recipe.nutrition?.proteinContent) || null,
                carbs: parseInt(recipe.nutrition?.carbohydrateContent) || null,
                fat: parseInt(recipe.nutrition?.fatContent) || null,
                keywords: Array.isArray(recipe.keywords) ? recipe.keywords.join(', ') : (recipe.keywords || ''),
                sourceUrl: url
              };
              break;
            }
          }
        }
      } catch (e) {
        console.log('JSON-LD parse error:', e.message);
      }
    }

    // Fallback: Try to extract from meta tags if no JSON-LD
    if (!recipeData) {
      const titleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]*)"/i);
      const descMatch = html.match(/<meta[^>]*property="og:description"[^>]*content="([^"]*)"/i);
      const imageMatch = html.match(/<meta[^>]*property="og:image"[^>]*content="([^"]*)"/i);
      
      if (titleMatch) {
        recipeData = {
          title: decodeHtmlEntities(titleMatch[1]),
          author: '',
          description: descMatch ? decodeHtmlEntities(descMatch[1]) : '',
          ingredients: [],
          instructions: '',
          image: imageMatch ? imageMatch[1] : ''
        };
      }
    }

    if (!recipeData) {
      throw new functions.https.HttpsError('not-found', 'Could not extract recipe data from this URL');
    }

    return { success: true, recipe: recipeData };

  } catch (error) {
    console.error('Import error:', error.message);
    throw new functions.https.HttpsError('internal', `Failed to import recipe: ${error.message}`);
  }
});

// Helper: Parse ISO 8601 duration (PT30M -> 30)
function parseDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (match) {
    return (parseInt(match[1] || 0) * 60) + parseInt(match[2] || 0);
  }
  return 0;
}

// Helper: Parse servings (4 servings -> 4)
function parseServings(yield_) {
  if (!yield_) return null;
  const match = String(yield_).match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Helper: Decode HTML entities
function decodeHtmlEntities(str) {
  if (!str) return '';
  return str.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec))
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
}