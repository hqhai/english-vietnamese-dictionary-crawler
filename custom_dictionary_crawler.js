const fs = require('fs');
const fetch = require('node-fetch');

/**
 * Đọc danh sách từ từ file
 * @param {string} filePath - Đường dẫn đến file chứa danh sách từ
 * @param {string} format - Định dạng của file (json, txt, js)
 * @returns {string[]} - Mảng chứa danh sách các từ
 */
function readWordList(filePath, format = 'json') {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    if (format === 'json') {
      return JSON.parse(fileContent);
    } else if (format === 'txt') {
      return fileContent.split('\n').filter(line => line.trim() !== '');
    } else {
      console.error('Định dạng file không được hỗ trợ');
      return [];
    }
  } catch (error) {
    console.error('Lỗi khi đọc file danh sách từ:', error);
    return [];
  }
}

/**
 * Hàm chính để lấy dữ liệu từ từ điển
 * @param {string} word - Từ cần tra cứu
 * @returns {Object} - Dữ liệu đã được xử lý
 */
async function getDictionaryData(word) {
  try {
    // URL của API tra cứu từ điển
    const url = `https://api.tracau.vn/WBBcwnwQpV89/s/${encodeURIComponent(word)}/en`;
    console.log(`Đang tải dữ liệu cho từ "${word}" từ: ${url}`);

    // Gọi API để lấy dữ liệu JSON
    const response = await fetch(url);
    const data = await response.json();
    
    // Xử lý dữ liệu thành đối tượng JSON có cấu trúc theo yêu cầu
    const result = processData(data, word);
    return result;
  } catch (error) {
    console.error(`Lỗi khi xử lý dữ liệu cho từ "${word}":`, error);
    return null;
  }
}

/**
 * Xử lý dữ liệu JSON thành cấu trúc theo yêu cầu
 * @param {Object} data - Dữ liệu từ API
 * @param {string} word - Từ đang tra cứu
 * @returns {Object} - Đối tượng JSON có cấu trúc
 */
function processData(data, word) {
  // Tạo đối tượng kết quả theo cấu trúc mới tập trung vào anh-việt
  const result = {
    word: word,
    phonetic: "",
    definition: {
      type: "", // danh từ, động từ, tính từ...
      basic_meanings: [], // nghĩa cơ bản
      phrases: [] // cụm từ và thành ngữ
    },
    terms: {
      economic: [], // thuật ngữ kinh tế
      technical: []  // thuật ngữ kỹ thuật
    },
    examples: [] // ví dụ câu
  };

  // 1. Trích xuất nghĩa cơ bản từ sentences
  if (data.sentences && Array.isArray(data.sentences)) {
    // Tìm nghĩa cơ bản của từ (từ đơn không phải cụm từ)
    const basicMeaningEntry = data.sentences.find(entry => 
      entry.fields && 
      entry.fields.en && 
      entry.fields.en.replace(/\u003cem\u003e|\u003c\/em\u003e/g, '').trim().toLowerCase() === word.toLowerCase()
    );
    
    if (basicMeaningEntry && basicMeaningEntry.fields.vi) {
      result.definition.basic_meanings.push(basicMeaningEntry.fields.vi);
    }
    
    // Thu thập các cụm từ và ví dụ liên quan
    data.sentences.forEach(entry => {
      if (!entry.fields) return;
      
      const englishText = entry.fields.en.replace(/\u003cem\u003e|\u003c\/em\u003e/g, '').trim();
      const vietnameseText = entry.fields.vi;
      
      // Nếu là cụm từ chứa từ đang tìm (không phải từ đơn)
      if (englishText.toLowerCase().includes(word.toLowerCase()) && 
          englishText.toLowerCase() !== word.toLowerCase()) {
        
        // Kiểm tra xem có phải là câu ví dụ (có dấu chấm câu) hay không
        if (englishText.includes('.') || 
            englishText.includes('?') || 
            englishText.includes('!') ||
            englishText.startsWith('I ') ||
            englishText.startsWith('THE ')) {
          // Đây là câu ví dụ
          result.examples.push({
            en: englishText,
            vi: vietnameseText
          });
        } else {
          // Đây là cụm từ
          result.definition.phrases.push({
            phrase: englishText,
            meaning: vietnameseText
          });
        }
      }
    });
  }

  // 2. Trích xuất từ phần tratu (nội dung từ điển chính)
  if (data.tratu && Array.isArray(data.tratu) && data.tratu.length > 0) {
    const dictContent = data.tratu[0];
    
    if (dictContent.fields && dictContent.fields.fulltext) {
      const html = dictContent.fields.fulltext;
      
      // Trích xuất phiên âm
      const pronunciationMatch = html.match(/<font color="#9e9e9e">\[(.*?)\]<\/font>/);
      if (pronunciationMatch) {
        result.phonetic = pronunciationMatch[1];
      }
      
      // Trích xuất từ loại
      const partOfSpeechMatch = html.match(/<b><font color="#1a76bf">([^<]+)<\/font><\/b>/);
      if (partOfSpeechMatch) {
        result.definition.type = partOfSpeechMatch[1];
      } else {
        const altPartOfSpeechMatch = html.match(/<font color="#1a76bf">([^<]+)<\/font>/);
        if (altPartOfSpeechMatch) {
          result.definition.type = altPartOfSpeechMatch[1];
        }
      }
      
      // Trích xuất nghĩa cơ bản (nếu chưa có)
      if (result.definition.basic_meanings.length === 0) {
        const basicMeaningMatches = html.match(/<td id="I_C"><font color="#999">■<\/font><\/td><td id="C_C" colspan="2">([^<]+)<\/td>/g);
        if (basicMeaningMatches) {
          basicMeaningMatches.forEach(match => {
            const meaningMatch = match.match(/<td id="C_C" colspan="2">([^<]+)<\/td>/);
            if (meaningMatch && meaningMatch[1].trim() && !meaningMatch[1].includes("(xem)")) {
              result.definition.basic_meanings.push(meaningMatch[1].trim());
            }
          });
        }
      }
      
      // Trích xuất các cụm từ từ phần từ điển
      const phraseMatches = html.match(/<td id="I_C"><font color="#1371BB">▸<\/font><\/td><td id="C_C" colspan="2"><font color="#1371BB">([^<]+)<\/font>/g);
      
      if (phraseMatches) {
        phraseMatches.forEach(match => {
          const phraseMatch = match.match(/<font color="#1371BB">([^<]+)<\/font>/);
          
          if (phraseMatch) {
            const phrase = phraseMatch[1].trim();
            const phraseIndex = html.indexOf(match);
            
            // Tìm nghĩa trong 300 ký tự tiếp theo
            const nextContext = html.substring(phraseIndex, phraseIndex + 300);
            const meaningMatches = nextContext.match(/<td id="C_C">([^<]+)<\/td>/g);
            
            if (meaningMatches && meaningMatches.length > 0) {
              const meanings = [];
              
              meaningMatches.forEach(mMatch => {
                const meaning = mMatch.match(/<td id="C_C">([^<]+)<\/td>/);
                if (meaning && meaning[1].trim()) {
                  meanings.push(meaning[1].trim());
                }
              });
              
              if (meanings.length > 0) {
                // Kiểm tra xem cụm từ này đã được thêm vào chưa
                const existingPhrase = result.definition.phrases.find(p => p.phrase === phrase);
                
                if (existingPhrase) {
                  // Nếu đã có, thêm nghĩa mới vào
                  if (Array.isArray(existingPhrase.meanings)) {
                    meanings.forEach(m => {
                      if (!existingPhrase.meanings.includes(m)) {
                        existingPhrase.meanings.push(m);
                      }
                    });
                  } else if (existingPhrase.meaning) {
                    // Chuyển từ một nghĩa thành mảng nghĩa
                    existingPhrase.meanings = [existingPhrase.meaning, ...meanings];
                    delete existingPhrase.meaning;
                  }
                } else {
                  // Nếu chưa có, thêm mới
                  if (meanings.length === 1) {
                    result.definition.phrases.push({
                      phrase: phrase,
                      meaning: meanings[0]
                    });
                  } else {
                    result.definition.phrases.push({
                      phrase: phrase,
                      meanings: meanings
                    });
                  }
                }
              }
            }
          }
        });
      }

      // Trích xuất các thuật ngữ khác nhau
      if (html.includes('Từ điển Kinh tế')) {
        const economicSection = html.substring(html.indexOf('Từ điển Kinh tế'), html.indexOf('Từ điển Kinh tế') + 3000);
        const economicTermMatches = economicSection.match(/<font color="#005ba1">([^<]+)<\/font><font color="#282828">: ([^<]+)<\/font>/g);
        
        if (economicTermMatches) {
          economicTermMatches.forEach(match => {
            const termMatch = match.match(/<font color="#005ba1">([^<]+)<\/font><font color="#282828">: ([^<]+)<\/font>/);
            if (termMatch) {
              result.terms.economic.push({
                term: termMatch[1].trim(),
                meaning: termMatch[2].trim()
              });
            }
          });
        }
      }

      if (html.includes('Từ điển Kỹ thuật')) {
        const technicalSection = html.substring(html.indexOf('Từ điển Kỹ thuật'), html.indexOf('Từ điển Kỹ thuật') + 2000);
        
        // Trích xuất lĩnh vực
        const fieldMatch = technicalSection.match(/<font color="#666699">([^<]+)<\/font>/);
        const field = fieldMatch ? fieldMatch[1].trim() : "";
        
        // Trích xuất các thuật ngữ
        const technicalTermMatches = technicalSection.match(/<font color="#005ba1">([^<]+)<\/font>[\s\S]*?<font> ([^<]+)<\/font>/g);
        
        if (technicalTermMatches) {
          technicalTermMatches.forEach(match => {
            const termMatch = match.match(/<font color="#005ba1">([^<]+)<\/font>[\s\S]*?<font> ([^<]+)<\/font>/);
            if (termMatch) {
              result.terms.technical.push({
                term: termMatch[1].trim(),
                field: field,
                meaning: termMatch[2].trim().replace(/^■\s*/, '')
              });
            }
          });
        }
      }
    }
  }

  return result;
}

/**
 * Xử lý nhiều từ song song và lưu vào file
 * @param {string[]} wordList - Danh sách từ cần xử lý
 * @param {string} outputFile - File đầu ra
 * @param {Object} existingData - Dữ liệu hiện có
 * @param {Object} options - Tùy chọn cấu hình
 */
async function processMultipleWordsConcurrent(wordList, outputFile, existingData = {}, options = {}) {
  // Cấu hình mặc định
  const config = {
    concurrentLimit: 50,         // Số lượng yêu cầu đồng thời
    batchSize: 500,              // Kích thước lô (số từ trong mỗi đợt xử lý)
    activePeriod: 10000,         // Thời gian hoạt động (10 giây)
    pausePeriod: 5000,           // Thời gian nghỉ (5 giây)
    saveInterval: 200,           // Lưu sau mỗi 200 từ
    retryLimit: 3,               // Số lần thử lại nếu lỗi
    ...options
  };

  console.log(`Cấu hình xử lý song song:
  - Xử lý tối đa ${config.concurrentLimit} yêu cầu cùng lúc
  - Hoạt động ${config.activePeriod/1000}s, nghỉ ${config.pausePeriod/1000}s
  - Lưu kết quả sau mỗi ${config.saveInterval} từ
  - Số lần thử lại mỗi từ: ${config.retryLimit}`);

  const results = { ...existingData };
  let processedCount = 0;
  let lastSaveCount = 0;
  let errors = 0;
  let startTime = Date.now();

  // Xử lý từng lô từ
  for (let batchIndex = 0; batchIndex < wordList.length; batchIndex += config.batchSize) {
    const currentBatch = wordList.slice(batchIndex, batchIndex + config.batchSize);
    console.log(`\nĐang xử lý lô ${Math.floor(batchIndex / config.batchSize) + 1}/${Math.ceil(wordList.length / config.batchSize)}, ${currentBatch.length} từ...`);

    // Chia lô thành các nhóm nhỏ để xử lý bất đồng bộ
    for (let i = 0; i < currentBatch.length; i += config.concurrentLimit) {
      const startTime = Date.now();
      const wordGroup = currentBatch.slice(i, i + config.concurrentLimit);
      
      // Xử lý song song các từ trong nhóm hiện tại
      const promises = wordGroup.map(async (word) => {
        try {
          for (let attempt = 1; attempt <= config.retryLimit; attempt++) {
            try {
              const data = await getDictionaryData(word);
              if (data) {
                return { word, data, success: true };
              }
              return { word, success: false, error: 'Không nhận được dữ liệu' };
            } catch (error) {
              if (attempt === config.retryLimit) {
                throw error;
              }
              // Đợi 1s trước khi thử lại
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (error) {
          console.error(`Lỗi xử lý từ "${word}" sau ${config.retryLimit} lần thử:`, error.message);
          fs.appendFileSync('crawler_errors.log', `${new Date().toISOString()} - Từ "${word}": ${error.message}\n`);
          return { word, success: false, error: error.message };
        }
      });

      try {
        const outcomes = await Promise.all(promises);
        
        // Xử lý kết quả
        outcomes.forEach(outcome => {
          if (outcome.success) {
            results[outcome.word] = outcome.data;
            processedCount++;
            console.log(`✓ ${outcome.word}`);
          } else {
            errors++;
            console.error(`✗ ${outcome.word}: ${outcome.error}`);
          }
        });

        // Lưu theo khoảng thời gian
        if (processedCount - lastSaveCount >= config.saveInterval) {
          fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
          const elapsedTime = (Date.now() - startTime) / 1000;
          const wordsPerSecond = processedCount / elapsedTime;
          console.log(`Đã lưu ${Object.keys(results).length} từ (${processedCount} từ mới). Tốc độ: ${wordsPerSecond.toFixed(2)} từ/giây`);
          lastSaveCount = processedCount;
        }

        // Nghỉ 5 giây sau mỗi 10 giây hoạt động
        const elapsedTime = Date.now() - startTime;
        if (elapsedTime >= config.activePeriod) {
          console.log(`Đã hoạt động ${config.activePeriod/1000}s, tạm nghỉ ${config.pausePeriod/1000}s...`);
          await new Promise(resolve => setTimeout(resolve, config.pausePeriod));
          startTime = Date.now(); // Reset thời gian bắt đầu
        }
      } catch (batchError) {
        console.error('Lỗi khi xử lý lô từ:', batchError);
        // Vẫn lưu dữ liệu hiện có nếu xảy ra lỗi
        fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
      }
    }

    // Lưu sau mỗi lô lớn
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Đã hoàn thành lô ${Math.floor(batchIndex / config.batchSize) + 1}, đã lưu ${Object.keys(results).length} từ`);
  }

  // Thống kê cuối cùng
  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`\n===== Thống kê =====`);
  console.log(`Tổng số từ đã xử lý: ${Object.keys(results).length}`);
  console.log(`Số từ mới xử lý trong phiên này: ${processedCount}`);
  console.log(`Số lỗi: ${errors}`);
  console.log(`Thời gian xử lý: ${totalTime.toFixed(2)}s`);
  console.log(`Tốc độ trung bình: ${(processedCount / totalTime).toFixed(2)} từ/giây`);

  let totalMeanings = 0;
  let totalPhrases = 0;
  let totalTerms = 0;
  let totalExamples = 0;
  
  for (const word in results) {
    const data = results[word];
    
    totalMeanings += data.definition.basic_meanings.length;
    totalPhrases += data.definition.phrases.length;
    totalTerms += data.terms.economic.length + data.terms.technical.length;
    totalExamples += data.examples.length;
  }
  
  console.log(`Tổng số nghĩa cơ bản đã trích xuất: ${totalMeanings}`);
  console.log(`Tổng số cụm từ đã trích xuất: ${totalPhrases}`);
  console.log(`Tổng số thuật ngữ chuyên ngành đã trích xuất: ${totalTerms}`);
  console.log(`Tổng số ví dụ đã trích xuất: ${totalExamples}`);
  
  return results;
}

// Đọc danh sách từ từ file đã trích xuất
const wordListFile = './word_list.json';
const wordList = readWordList(wordListFile, 'json');

// Kiểm tra nếu wordList trống hoặc không tồn tại
if (!wordList || wordList.length === 0) {
  console.error('Không tìm thấy danh sách từ trong file. Vui lòng chạy extract_words.js trước!');
  process.exit(1);
}

console.log(`Đã đọc được ${wordList.length} từ từ file ${wordListFile}`);

// Kiểm tra xem đã có dữ liệu crawler trước đó chưa
let existingResults = {};
const outputFile = 'anhviet_dictionary_data.json';

try {
  const existingData = fs.readFileSync(outputFile, 'utf8');
  existingResults = JSON.parse(existingData);
  console.log(`Đã tìm thấy dữ liệu cũ với ${Object.keys(existingResults).length} từ đã xử lý.`);
} catch (error) {
  console.log('Không tìm thấy dữ liệu cũ, bắt đầu crawl từ đầu.');
}

// Lọc ra những từ chưa được xử lý
const processedWords = Object.keys(existingResults);
const remainingWords = wordList.filter(word => !processedWords.includes(word));

console.log(`Còn ${remainingWords.length} từ cần xử lý.`);

// Lấy tham số dòng lệnh nếu có
// 1. Số lượng từ muốn xử lý
const cmdLimit = parseInt(process.argv[2]);
// 2. Vị trí bắt đầu (nếu muốn bắt đầu từ từ thứ N)
const cmdStart = parseInt(process.argv[3]) || 0;
// 3. Số lượng xử lý đồng thời
const cmdConcurrent = parseInt(process.argv[4]) || 50;

// Nếu có giới hạn từ dòng lệnh thì dùng, nếu không thì xử lý tất cả
const wordLimit = !isNaN(cmdLimit) ? cmdLimit : remainingWords.length;

// Cắt danh sách từ theo vị trí bắt đầu và giới hạn
const limitedWordList = remainingWords.slice(cmdStart, cmdStart + wordLimit);
console.log(`Sẽ xử lý ${limitedWordList.length} từ, bắt đầu từ vị trí ${cmdStart}.`);

// Cấu hình tối ưu cho tốc độ cao
const options = {
  concurrentLimit: cmdConcurrent,  // Số lượng request đồng thời (có thể điều chỉnh)
  batchSize: 500,                  // Kích thước lô
  activePeriod: 10000,             // 10 giây hoạt động
  pausePeriod: 5000,               // 5 giây nghỉ
  saveInterval: 200,               // Lưu sau mỗi 200 từ
  retryLimit: 3                    // Số lần thử lại
};

// Gọi hàm xử lý song song
console.log(`Bắt đầu crawler tốc độ cao với ${options.concurrentLimit} yêu cầu song song...`);
processMultipleWordsConcurrent(limitedWordList, outputFile, existingResults, options)
  .then(() => console.log('Hoàn thành quá trình xử lý'))
  .catch(error => console.error('Lỗi trong quá trình xử lý:', error)); 