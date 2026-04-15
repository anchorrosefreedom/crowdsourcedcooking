# Cookbook Feature Plan

## Overview
Create a "My Cookbook" feature where users can save/favorite recipes they create, MiMO, or want to revisit later.

## Current State
- **MiMO button** exists on recipe.html - links to submit-recipe.html?mimo={id}
- **No save/favorite functionality** currently
- **No cookbook page** exists
- **Auth system** exists (Firebase Auth)

## Implementation Plan

### Phase 1: Data Structure
Add `savedBy` and `isSaved` fields to recipe data model:
- When user creates recipe → auto-save to their cookbook
- When user MiMOs recipe → save both original and new to cookbook
- Add "Save to Cookbook" button on recipe page

### Phase 2: Cookbook Page
Create `my-cookbook.html`:
- Display user's saved/MiMO'd recipes
- Filter by: All, Created, MiMO'd, Favorites
- Grid layout consistent with existing pages
- Link from nav bar

### Phase 3: Save/Favorite Actions
- Add "Save" button on recipe.html
- Add "Unsave" toggle
- Store userId with recipe in "savedBy" array

### Phase 4: My Cookbook Page
Create `my-cookbook-new.html` (already exists - use this as reference)

## Key Considerations
1. **Don't break existing code** - work on cookbook-dev branch
2. **Use existing patterns** - follow established nav, card layouts, auth flow
3. **Test thoroughly** - run test suite before any merge

## Files to Modify/Create
- [ ] my-cookbook.html (new - main cookbook page)
- [ ] recipe.html (add Save button + handle mimo param)
- [ ] submit-recipe.html (handle mimo param to pre-fill)
- [ ] nav.html (add My Cookbook link)

## Testing
- Run existing test suite: `cd tests && bash run.sh`
- Verify no regressions on main pages

## Dev Branch: cookbook-dev

### Created Files
- my-cookbook.html - New cookbook page with filter tabs (All/Created/MiMO'd/Saved)

### Next Steps
1. Add "Save to Cookbook" button to recipe.html
2. Add authorId to saved recipes (need to track who created)
3. Test locally before deploying to Firebase test project
4. Add saveRecipe cloud function or update Firestore rules

### Test URL (deploy to Firebase Hosting)
https://crowdsourcedcooking.web.app/my-cookbook.html (still uses production Firebase)

