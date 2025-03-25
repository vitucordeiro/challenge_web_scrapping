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

  