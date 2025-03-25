const fs = require('fs')

const REGION_ID = "v2.16805FBD22EC494F5D2BD799FE9F1FB7";
const OUTPUT_FILE = 'output.json';
var MAX_ITEMS;
const BATCH_SIZE = 100;
const DELAY = 1000;

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
        
        
        console.log(`✅ ${batchCount} collected items | Total: ${totalCollected}/${MAX_ITEMS}`);
        console.log(`➡️ Next cursor: ${after}`);
  
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

extractAllProductsComplete()
  .then(products => {
    console.log('\n📊 Final resume:');
    console.log(`- Total of products: ${products.length}`);
  })
  .catch(error => {
    console.error('❌ Error in execution:', error);
  });