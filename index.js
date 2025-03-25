const fs = require('fs')

const REGION_ID = "v2.16805FBD22EC494F5D2BD799FE9F1FB7";
const OUTPUT_FILE = 'output.json';
var MAX_ITEMS;
const BATCH_SIZE = 100;
const DELAY = 1000;

/**
 * Fetches a batch of products from Carrefour's GraphQL API
 * @async
 * @function fetchProductsBatch
 * @param {string} [after="0"] - Pagination cursor (defaults to "0" for first page)
 * @returns {Promise<Object>} - Parsed JSON response from the API
 * @throws {Error} - If the API request fails
 * 
 * @description
 * Makes a GET request to Carrefour's GraphQL API to fetch products with:
 * - Pagination support (using 'after' cursor)
 * - Fixed batch size (BATCH_SIZE)
 * - Predefined filters (beverages category, pt-BR locale)
 * - Region-specific results (REGION_ID)
 * 
 * The query includes these fixed parameters:
 * - isPharmacy: false
 * - sort: "score_desc"
 * - term: "" (empty search term)
 * 
 * @example
 * // Fetch first batch
 * const firstBatch = await fetchProductsBatch();
 * 
 * // Fetch next batch using cursor
 * const nextBatch = await fetchProductsBatch("cursor123");
 */

async function fetchProductsBatch(after = "0") {
    const url = `https://mercado.carrefour.com.br/api/graphql?operationName=ProductsQuery&variables=${encodeURIComponent(JSON.stringify({
      isPharmacy: false,
      first: BATCH_SIZE,
      after: after,
      sort: "score_desc",
      term: "",
      selectedFacets: [
        {key: "category-1", value: "bebidas"},
        {key: "category-1", value: "4599"},
        {key: "channel", value: JSON.stringify({ 
          salesChannel: 2, 
          regionId: REGION_ID 
        })},
        {key: "locale", value: "pt-BR"},
        {key: "region-id", value: REGION_ID}
      ]
    }))}`;
    try{
        const response = await fetch(url);
        return await response.json();
    }catch(e){
        throw new Error("Error: fetching data from the API - ", e);
    }
  }

/**
 * Extracts all products from Carrefour's API using paginated requests
 * @async
 * @function extractAllProductsComplete
 * @returns {Promise<string[]>} - Array of all product names collected
 * @throws {Error} - If critical failures occur during execution
 * 
 * @description
 * Performs complete product extraction with these features:
 * - Automatically determines total items (MAX_ITEMS) from initial request
 * - Paginates through all results using offset-based pagination
 * - Implements retry logic (5 attempts) for failed requests
 * - Includes progress tracking and periodic saves (every 500 items)
 * - Provides real-time console feedback about extraction progress
 * - Enforces rate limiting through DELAY between requests
 * - Saves final results to JSON file (OUTPUT_FILE)
 * 
 * @process
 * 1. Initializes with first batch to get total count
 * 2. Processes batches sequentially until all items collected
 * 3. Handles errors with exponential backoff (DELAY*2 on retry)
 * 4. Provides completion statistics and saves final output
 * 
 * @example
 * // Basic usage
 * extractAllProductsComplete()
 *   .then(products => console.log(`Collected ${products.length} products`))
 *   .catch(err => console.error('Extraction failed:', err));
 * 
 * // With async/await
 * try {
 *   const products = await extractAllProductsComplete();
 *   // Process products...
 * } catch (error) {
 *   // Handle error...
 * }
 */

  async function extractAllProductsComplete() {
    let allProducts = [];
    let after = "0";
    let hasMore = true;
    let attempts = 0;
    let totalCollected = 0;

    try{
        const initialData = await fetchProductsBatch(after);
        const raw = initialData.data.search.products.pageInfo.totalCount;
        MAX_ITEMS = raw;
      }catch(e){
        console.error(e)
    }

    console.log('🚀 Starting full extraction...');
    console.log(`🔍 Expected total: ${MAX_ITEMS} itens`);
  
    while (hasMore && totalCollected < MAX_ITEMS && attempts < 5) {
      try {
        console.log(`Fetching batch from cursor: ${after}`);
        
        const data = await fetchProductsBatch(after);
        
        if (!data?.data?.search?.products) {
          throw new Error('Invalid response structure');
        }
  
        const products = data.data.search.products.edges.map(edge => edge.node.name);
        const batchCount = products.length;
        
        allProducts = [...allProducts, ...products];
        totalCollected += batchCount;
        
        const nextOffset = parseInt(after) + BATCH_SIZE;
        after = String(nextOffset);
        
        let lastLogged = Date.now();
        const LOG_INTERVAL_MS = 5000; // 5 seconds
        
        if (Date.now() - lastLogged >= LOG_INTERVAL_MS) {
          console.log(`Progress: ${totalCollected}/${MAX_ITEMS}`);
          lastLogged = Date.now();
        }
        
        attempts = 0;
        
        if (totalCollected % 500 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
          console.log('Progress saved');
        }
  
        await new Promise(resolve => setTimeout(resolve, DELAY));
  
      } catch (error) {
        attempts++;
        console.error(`⚠️ Error (attempt ${attempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, DELAY * 2));
      }
    }

    console.log('\n Final check:');
    console.log(`- Expected items: ${MAX_ITEMS}`);
    console.log(`- Collected items: ${totalCollected}`);
    console.log(`- Difference: ${MAX_ITEMS - totalCollected}`);
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
    console.log(`\n🎉 Data saved : ${OUTPUT_FILE}`);
      
    return allProducts;
}

/**
 * @file Main execution block for product extraction
 * @description
 * Initiates the product extraction process and handles the results/errors.
 * Provides formatted console output for both success and failure cases.
 * 
 * @example
 * // Typical successful output:
 * 📊 Final resume:
 * - Total of products: 1243
 * 
 * // Typical error output:
 * ❌ Error in execution: [Error message]
 * 
 * @process
 * 1. Calls extractAllProductsComplete() to start extraction
 * 2. On success:
 *    - Displays formatted summary with product count
 * 3. On failure:
 *    - Displays error message with error details
 * 
 * @outputs
 * Success case:
 * - Formatted success message with emoji
 * - Total product count
 * 
 * Error case:
 * - Formatted error message with emoji
 * - Full error object
 */

extractAllProductsComplete()
  .then(products => {
    console.log('\n📊 Final resume:');
    console.log(`- Total of products: ${products.length}`);
  })
  .catch(error => {
    console.error('❌ Error in execution:', error);
  });