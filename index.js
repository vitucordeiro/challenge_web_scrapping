const fs = require('fs')

const REGION_ID = "v2.16805FBD22EC494F5D2BD799FE9F1FB7";
const OUTPUT_FILE = 'output.json';
const MAX_ITEMS = 0; 
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
  
    console.log('🚀 Iniciando extração completa...');
    console.log(`🔍 Total esperado: ${MAX_ITEMS} itens`);
  
    while (hasMore && totalCollected < MAX_ITEMS && attempts < 5) {
      try {
        console.log(`Buscando lote a partir do cursor: ${after}`);
        
        const data = await fetchProductsBatch(after);
        
        if (!data?.data?.search?.products) {
          throw new Error('Estrutura de resposta inválida');
        }
  
        const products = data.data.search.products.edges.map(edge => edge.node.name);
        const batchCount = products.length;
        
        allProducts = [...allProducts, ...products];
        totalCollected += batchCount;
        
        hasMore = data.data.search.products.pageInfo.hasNextPage;
        after = data.data.search.products.pageInfo.endCursor;
        
        console.log(`✅ ${batchCount} itens coletados | Total: ${totalCollected}/${MAX_ITEMS}`);
        console.log(`➡️ Próximo cursor: ${after}`);
  
        attempts = 0;
        
        if (totalCollected % 500 === 0) {
          fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
          console.log('Progresso salvo');
        }
  
        await new Promise(resolve => setTimeout(resolve, DELAY));
  
      } catch (error) {
        attempts++;
        console.error(`⚠️ Erro (tentativa ${attempts}): ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, DELAY * 2));
      }
    }

    console.log('\n Verificação final:');
    console.log(`- Itens esperados: ${MAX_ITEMS}`);
    console.log(`- Itens coletados: ${totalCollected}`);
    console.log(`- Diferença: ${MAX_ITEMS - totalCollected}`);
    
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(allProducts, null, 2));
    console.log(`\n🎉 Dados salvos em ${OUTPUT_FILE}`);
      
    return allProducts;
}