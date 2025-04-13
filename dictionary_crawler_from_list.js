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
 * Hàm chính để xử lý nhiều từ và lưu vào file
 * @param {string[]} wordList - Danh sách các từ cần tra cứu
 * @param {string} outputFile - Đường dẫn file đầu ra
 * @param {number} batchSize - Số lượng từ xử lý trong một lô
 * @param {number} delayBetweenBatches - Thời gian chờ giữa các lô (ms)
 */
async function processMultipleWords(wordList, outputFile, batchSize = 10, delayBetweenBatches = 5000) {
  const results = {};
  let processedCount = 0;
  
  // Chia danh sách từ thành các lô nhỏ
  for (let i = 0; i < wordList.length; i += batchSize) {
    const batch = wordList.slice(i, i + batchSize);
    console.log(`\nĐang xử lý lô ${Math.floor(i/batchSize) + 1}/${Math.ceil(wordList.length/batchSize)}, ${batch.length} từ...`);
    
    // Xử lý từng từ trong lô
    for (const word of batch) {
      console.log(`Đang xử lý dữ liệu cho từ: ${word}`);
      const data = await getDictionaryData(word);
      if (data) {
        results[word] = data;
        processedCount++;
        console.log(`Hoàn thành xử lý dữ liệu cho từ: ${word}`);
      }
      
      // Chờ 1 giây giữa các yêu cầu để tránh quá tải server
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Lưu kết quả tạm thời sau mỗi lô
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    console.log(`Đã lưu ${processedCount}/${wordList.length} từ vào file: ${outputFile}`);
    
    // Chờ giữa các lô để tránh quá tải server
    if (i + batchSize < wordList.length) {
      console.log(`Tạm nghỉ ${delayBetweenBatches/1000} giây trước khi xử lý lô tiếp theo...`);
      await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
    }
  }
  
  // Hiển thị thống kê
  console.log("\n=== Thống kê ===");
  console.log(`Số từ đã xử lý: ${Object.keys(results).length}/${wordList.length}`);
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

// Lấy tham số dòng lệnh nếu có (số lượng từ muốn xử lý)
const cmdLimit = parseInt(process.argv[2]);
const wordLimit = !isNaN(cmdLimit) ? cmdLimit : 20; // Mặc định lấy 20 từ đầu tiên

// Giới hạn số từ để xử lý
const limitedWordList = wordList.slice(0, wordLimit);
console.log(`Sẽ xử lý ${limitedWordList.length} từ đầu tiên từ danh sách.`);

// Cấu hình cho crawler
const batchSize = 5; // 5 từ một lô
const delayBetweenBatches = 10000; // 10 giây chờ giữa các lô
const outputFile = 'anhviet_dictionary_data.json';

// Gọi hàm chính để bắt đầu xử lý
console.log(`Bắt đầu crawler với cấu hình: ${batchSize} từ/lô, ${delayBetweenBatches/1000}s giữa các lô`);
processMultipleWords(limitedWordList, outputFile, batchSize, delayBetweenBatches)
  .then(() => console.log('Hoàn thành quá trình xử lý'))
  .catch(error => console.error('Lỗi trong quá trình xử lý:', error)); 