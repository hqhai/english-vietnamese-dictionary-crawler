const fs = require('fs');
const path = require('path');

/**
 * Trích xuất danh sách từ từ file từ điển Anh-Việt
 * @param {string} filePath - Đường dẫn đến file từ điển
 * @param {number} limit - Số lượng từ tối đa muốn trích xuất (0 = không giới hạn)
 * @returns {string[]} - Mảng chứa danh sách các từ
 */
function extractWordList(filePath, limit = 0) {
  try {
    console.log(`Đang đọc file từ điển: ${filePath}`);
    
    // Đọc file theo từng dòng để tránh tải toàn bộ file vào bộ nhớ
    const words = [];
    let currentWord = null;
    
    // Đọc file theo dòng
    const data = fs.readFileSync(filePath, 'utf8');
    const lines = data.split('\n');
    
    for (const line of lines) {
      // Nếu dòng bắt đầu bằng @ thì đó là một từ mới
      if (line.startsWith('@')) {
        // Trích xuất từ: bỏ ký tự @ và phần phiên âm nằm trong /.../ (nếu có)
        let wordText = line.substring(1).trim();
        
        // Loại bỏ phần phiên âm (nếu có)
        const phoneticsIndex = wordText.indexOf('/');
        if (phoneticsIndex !== -1) {
          wordText = wordText.substring(0, phoneticsIndex).trim();
        }
        
        // Thêm từ vào danh sách
        if (wordText) {
          words.push(wordText);
          
          // Kiểm tra giới hạn số lượng từ
          if (limit > 0 && words.length >= limit) {
            break;
          }
        }
      }
    }
    
    console.log(`Đã trích xuất ${words.length} từ từ file từ điển`);
    return words;
  } catch (error) {
    console.error('Lỗi khi trích xuất danh sách từ:', error);
    return [];
  }
}

/**
 * Lưu danh sách từ vào file
 * @param {string[]} wordList - Danh sách từ
 * @param {string} outputFile - Đường dẫn file đầu ra
 * @param {string} format - Định dạng đầu ra (json, txt, js)
 */
function saveWordList(wordList, outputFile, format = 'json') {
  try {
    let content = '';
    
    if (format === 'json') {
      // Lưu dưới dạng JSON
      content = JSON.stringify(wordList, null, 2);
    } else if (format === 'txt') {
      // Lưu dưới dạng văn bản thuần, mỗi từ một dòng
      content = wordList.join('\n');
    } else if (format === 'js') {
      // Lưu dưới dạng biến JavaScript
      content = `// Danh sách từ được trích xuất từ file từ điển Anh-Việt\n`;
      content += `// Số lượng từ: ${wordList.length}\n\n`;
      content += `const wordList = ${JSON.stringify(wordList, null, 2)};\n\n`;
      content += `module.exports = wordList;\n`;
    } else {
      throw new Error(`Định dạng không được hỗ trợ: ${format}`);
    }
    
    fs.writeFileSync(outputFile, content, 'utf8');
    console.log(`Đã lưu ${wordList.length} từ vào file: ${outputFile}`);
  } catch (error) {
    console.error('Lỗi khi lưu danh sách từ:', error);
  }
}

// Đường dẫn đến file từ điển (cần điều chỉnh cho phù hợp với hệ thống của bạn)
const dictionaryFilePath = './anhviet109K.txt';
// File đầu ra
const outputFilePath = './word_list';

// Kiểm tra xem file có tồn tại không
try {
  fs.accessSync(dictionaryFilePath, fs.constants.R_OK);
  console.log(`File từ điển tồn tại và có thể đọc được: ${dictionaryFilePath}`);
} catch (error) {
  // Nếu không tìm thấy, thử với đường dẫn khác
  console.error(`Không tìm thấy file từ điển tại: ${dictionaryFilePath}`);
  console.log('Thử tìm ở vị trí khác...');
  
  const altPaths = [
    '../avdict-database-sqlite-converter/anhviet109K.txt',
    './avdict-database-sqlite-converter/anhviet109K.txt',
    '../anhviet109K.txt'
  ];
  
  let foundPath = null;
  for (const path of altPaths) {
    try {
      fs.accessSync(path, fs.constants.R_OK);
      console.log(`Tìm thấy file từ điển tại: ${path}`);
      foundPath = path;
      break;
    } catch (err) {
      console.log(`Không tìm thấy file tại: ${path}`);
    }
  }
  
  if (foundPath) {
    console.log(`Sử dụng file từ điển tại: ${foundPath}`);
    // Trích xuất 1000 từ đầu tiên và lưu vào các file khác nhau
    const wordList = extractWordList(foundPath, 1000);
    
    // Lưu dưới dạng file JSON
    saveWordList(wordList, `${outputFilePath}.json`, 'json');
    
    // Lưu dưới dạng file văn bản thuần
    saveWordList(wordList, `${outputFilePath}.txt`, 'txt');
    
    // Lưu dưới dạng module JavaScript
    saveWordList(wordList, `${outputFilePath}.js`, 'js');
    
    console.log('Đã hoàn thành trích xuất và lưu danh sách từ!');
    process.exit(0);
  } else {
    console.error('Không tìm thấy file từ điển ở bất kỳ vị trí nào. Vui lòng kiểm tra lại đường dẫn.');
    process.exit(1);
  }
}

// Nếu tìm thấy file ở vị trí ban đầu, tiếp tục xử lý
console.log('Bắt đầu trích xuất từ...');
// Trích xuất 1000 từ đầu tiên và lưu vào các file khác nhau
const wordList = extractWordList(dictionaryFilePath, 1000);

// Lưu dưới dạng file JSON
saveWordList(wordList, `${outputFilePath}.json`, 'json');

// Lưu dưới dạng file văn bản thuần
saveWordList(wordList, `${outputFilePath}.txt`, 'txt');

// Lưu dưới dạng module JavaScript
saveWordList(wordList, `${outputFilePath}.js`, 'js');

console.log('Đã hoàn thành trích xuất và lưu danh sách từ!'); 