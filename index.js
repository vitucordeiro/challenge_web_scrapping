const puppeteer = require('puppeteer');
const fs = require('fs');

/**
 * Main function to scrape Carrefour beverage products
 * Handles browser initialization, page navigation, data extraction and saving results
 */
async function bootstrap() {
    /** Initialize browser instance */
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    
    /** Configure browser to mimic human user */
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
  
    try {
        /**
         * Step 1: Navigate to main beverages page
         * Waits for network to be idle before proceeding
         */
        await page.goto('https://mercado.carrefour.com.br/bebidas#crfint=hm|header-menu-corredores|bebidas|4', { 
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        /**
         * Step 2: Configure store location (Piracicaba)
         * - Opens location dialog
         * - Selects city from dropdown
         * - Confirms selection
         */
        console.log('Locating "Insert your ZIP code" button...');
        await page.waitForSelector('button[title="Insira seu CEP"]', { timeout: 5000 });
        await page.click('button[title="Insira seu CEP"]');
        await page.waitForSelector('div[role="dialog"]', { visible: true });
        await page.click('button.border-\\[\\#ccc\\].bg-white.text-red-market');
        await page.click('.border-neutral-300.h-\\[40px\\].shadow-\\[0px_8px_16px_rgba\\(90\\,100\\,110\\,0\\.12\\)\\]');
        await page.select('select#selectCity', 'Piracicaba');
        await page.click('.border-neutral-300.rounded-md.shadow.py-3.px-4.cursor-pointer');

        /**
         * Step 3: Configure pagination to show 60 items per page
         * - Navigates to specific category URL
         * - Changes items per page setting
         */
        await page.goto('https://mercado.carrefour.com.br/bebidas?category-1=bebidas&category-1=4599&facets=category-1&sort=score_desc&page=1', { 
            waitUntil: 'networkidle2',
            timeout: 15000
        });

        await page.waitForSelector('button[data-testid="store-button"]:has(span.text-\\[\\#E81E26\\])', { timeout: 10000 });
        await page.click('button[data-testid="store-button"]:has(span.text-\\[\\#E81E26\\])');
        await page.setDefaultTimeout(1000);
        
        const buttons = await page.$$('button[data-testid="store-button"].text-\\[\\#E81E26\\]');
        for (const button of buttons) {
            const text = await button.evaluate(el => el.textContent.trim());
            if (text === '60') {
                await button.click();
                break;
            }
        }
        await page.setDefaultTimeout(1000);

        /**
         * Step 4: Paginate through all available pages and extract product data
         * - Processes each page sequentially
         * - Extracts product information
         * - Handles pagination automatically
         */
        let allItems = [];
        let currentPage = 1;
        let hasMorePages = true;

        while (hasMorePages) {
            console.log(`Processing page ${currentPage}...`);
            
            /** Verify if current page contains products */
            setTimeout(()=>{
                2000
            })
            const itemsExist = await page.evaluate(() => {
                
                return document.querySelectorAll('ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 li').length > 0;
            });

            if (!itemsExist) {
                console.log('No items found on page, ending...');
                hasMorePages = false;
                break;
            }

            /** Extract product data from current page */
            const pageItems = await page.$$eval(
                'ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 li',
                (elements) => 
                    elements
                        .filter(li => !li.querySelector('p.m-1.text-right.absolute.right-0.z-10'))
                        .map(el => ({
                            product: el.querySelector('h3')?.textContent?.trim(),
                        }))
            );

            if (pageItems.length === 0) {
                console.log('No valid items found, ending...');
                hasMorePages = false;
                break;
            }

            allItems = [...allItems, ...pageItems];
            console.log(`Found ${pageItems.length} items on page ${currentPage}`);

            /** Attempt to navigate to next page */
            try {
                currentPage++;
                await page.goto(`https://mercado.carrefour.com.br/bebidas?category-1=bebidas&category-1=4599&facets=category-1&sort=score_desc&page=${currentPage}`, {
                    waitUntil: 'networkidle2',
                    timeout: 20000
                });
                
                /** Verify next page loaded correctly */
                await page.waitForSelector('ul.grid.grid-cols-2.xl\\:grid-cols-5.md\\:grid-cols-4 li:nth-child(1)', {
                    timeout: 10000,
                    visible: true
                });
            } catch (error) {
                console.log('Could not load next page, ending...');
                hasMorePages = false;
            }
        }

        /** Output results and save to file */
        console.log('Total items collected:', allItems.length);
        return fs.writeFileSync('output.json', JSON.stringify(allItems, null, 2))
    } catch (error) {
        console.error('Execution error:', error);
        throw error;
    } finally {
        /** Ensure browser is closed regardless of outcome */
        await browser.close();
    }
}

/** Execute the scraping process */
bootstrap();