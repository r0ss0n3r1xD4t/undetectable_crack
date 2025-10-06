const fs = require('fs/promises')

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// Tạo nhiều requests song song với batch size lớn
async function fetchConfigsBatch(baseUrl, start, batchSize = 500) {
  const url = new URL(baseUrl)
  url.searchParams.set('start', start.toString())
  url.searchParams.set('length', batchSize.toString()) // Tăng từ 100 lên 500
  
  console.log(`Fetching batch: start=${start}, length=${batchSize}`)
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        accept: 'application/json,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'en-US,en;q=0.9,vi;q=0.8',
        'cache-control': 'no-cache',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'sec-ch-ua': '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"Windows"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      method: 'GET',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const data = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      return { data: [], hasMore: false }
    }

    return { 
      data: data.data, 
      hasMore: data.data.length === batchSize,
      recordsTotal: data.recordsTotal || 0,
      recordsFiltered: data.recordsFiltered || 0
    }
  } catch (error) {
    console.error(`Error fetching batch ${start}:`, error.message)
    return { data: [], hasMore: false, error: error.message }
  }
}

// Fetch song song nhiều batches
async function fetchConfigsParallel(baseUrl, maxConcurrent = 5, batchSize = 500, maxRecords = 50000) {
  const allConfigs = []
  let currentStart = 0
  let totalFetched = 0
  let hasMore = true
  
  console.log(`Starting parallel fetch with ${maxConcurrent} concurrent requests, batch size: ${batchSize}`)
  
  while (hasMore && totalFetched < maxRecords) {
    // Tạo array các promises cho concurrent requests
    const promises = []
    const batchStarts = []
    
    for (let i = 0; i < maxConcurrent && (currentStart + i * batchSize) < maxRecords; i++) {
      const start = currentStart + (i * batchSize)
      batchStarts.push(start)
      promises.push(fetchConfigsBatch(baseUrl, start, batchSize))
    }
    
    // Chờ tất cả requests hoàn thành
    const results = await Promise.all(promises)
    
    // Xử lý kết quả
    let anyHasMore = false
    let batchCount = 0
    
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.data && result.data.length > 0) {
        allConfigs.push(...result.data)
        batchCount += result.data.length
        if (result.hasMore) anyHasMore = true
      }
      if (result.error) {
        console.error(`Batch ${batchStarts[i]} failed:`, result.error)
      }
    }
    
    totalFetched = allConfigs.length
    currentStart += maxConcurrent * batchSize
    hasMore = anyHasMore && totalFetched < maxRecords
    
    console.log(`✅ Fetched ${batchCount} configs in this round. Total: ${totalFetched}`)
    
    // Save progress mỗi vài batches
    if (totalFetched % 5000 === 0 || !hasMore) {
      await fs.writeFile('configs-progress.json', JSON.stringify(allConfigs, null, 2))
      console.log(`💾 Progress saved: ${totalFetched} configs`)
    }
    
    
    if (hasMore) {
      await sleep(200) 
    }
  }
  
  return allConfigs
}

// Optimized version với connection reuse
async function fetchConfigsOptimized(baseUrl, options = {}) {
  const {
    maxConcurrent = 8,      
    batchSize = 1000,      
    maxRecords = 100000,    
    delayMs = 100         
  } = options
  
  console.log(`🚀 Starting optimized fetch:`)
  console.log(`   - Max concurrent: ${maxConcurrent}`)
  console.log(`   - Batch size: ${batchSize}`)
  console.log(`   - Max records: ${maxRecords}`)
  console.log(`   - Delay: ${delayMs}ms`)
  
  const startTime = Date.now()
  const configs = await fetchConfigsParallel(baseUrl, maxConcurrent, batchSize, maxRecords)
  const endTime = Date.now()
  
  const duration = (endTime - startTime) / 1000
  const rate = configs.length / duration
  
  console.log(`⚡ Completed in ${duration.toFixed(2)}s`)
  console.log(`📊 Rate: ${rate.toFixed(2)} configs/second`)
  
  return configs
}

async function getConfigures() {
  const baseUrl = 'https://app.undetectable.io/configs/store-json?draw=16&columns%5B0%5D%5Bdata%5D=&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=id&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=true&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=os_type&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=true&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=Windows%2CMac%20OS%2CLinux&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=browser_type&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=true&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=browser_version&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=true&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=useragent&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=true&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B6%5D%5Bdata%5D=webgl&columns%5B6%5D%5Bname%5D=&columns%5B6%5D%5Bsearchable%5D=true&columns%5B6%5D%5Borderable%5D=true&columns%5B6%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B6%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B7%5D%5Bdata%5D=screen&columns%5B7%5D%5Bname%5D=&columns%5B7%5D%5Bsearchable%5D=true&columns%5B7%5D%5Borderable%5D=true&columns%5B7%5D%5Bsearch%5D%5Bvalue%5D=1024x768%2C1024x1366%2C1280x720%2C1280x800%2C1280x1024%2C1360x768%2C1366x768%2C1440x900%2C1536x864%2C1600x900%2C1680x1050%2C1920x1080%2C1920x1200&columns%5B7%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B8%5D%5Bdata%5D=hardware_concurrency&columns%5B8%5D%5Bname%5D=&columns%5B8%5D%5Bsearchable%5D=true&columns%5B8%5D%5Borderable%5D=true&columns%5B8%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B8%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B9%5D%5Bdata%5D=device_memory&columns%5B9%5D%5Bname%5D=&columns%5B9%5D%5Bsearchable%5D=true&columns%5B9%5D%5Borderable%5D=true&columns%5B9%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B9%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B10%5D%5Bdata%5D=created_at&columns%5B10%5D%5Bname%5D=&columns%5B10%5D%5Bsearchable%5D=true&columns%5B10%5D%5Borderable%5D=true&columns%5B10%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B10%5D%5Bsearch%5D%5Bregex%5D=false&order%5B0%5D%5Bcolumn%5D=1&order%5B0%5D%5Bdir%5D=desc&start=0&length=100'
  
  // Có thể tùy chỉnh các tham số
  const result = await fetchConfigsOptimized(baseUrl, {
    maxConcurrent: 10,    // 10 requests đồng thời
    batchSize: 1000,      // 1000 records mỗi request
    maxRecords: 50000,    // Tối đa 50k records
    delayMs: 50          // Chỉ nghỉ 50ms giữa các batch
  })
  
  return result
}

async function main() {
  try {
    console.log('🔥 Starting FAST config collection...')
    const configs = await getConfigures()
    
    if (configs.length > 0) {
      // Remove duplicates dựa trên ID
      const uniqueConfigs = configs.filter((config, index, self) => 
        index === self.findIndex(c => c.id === config.id)
      )
      
      await fs.writeFile('configs.json', JSON.stringify(uniqueConfigs, null, 2))
      console.log(`✅ SUCCESS! Collected ${uniqueConfigs.length} unique configurations`)
      console.log(`📁 Saved to configs.json (${configs.length - uniqueConfigs.length} duplicates removed)`)
      
      // Statistics
      const browsers = [...new Set(uniqueConfigs.map(c => c.browser_type))].filter(Boolean)
      const osTypes = [...new Set(uniqueConfigs.map(c => c.os_type))].filter(Boolean)
      
      console.log(`📊 Statistics:`)
      console.log(`   - Browsers: ${browsers.join(', ')}`)
      console.log(`   - OS Types: ${osTypes.join(', ')}`)
      
    } else {
      console.log('❌ No configurations were collected.')
    }
  } catch (error) {
    console.error('💥 Fatal error:', error.message)
    console.error(error.stack)
  }
}

main()

// Updated: 2025-06-18 10:11:00

// Updated: 2025-10-06 11:23:00
