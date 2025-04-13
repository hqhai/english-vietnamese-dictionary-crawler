# Crawler Từ Điển TracâU

Công cụ này giúp crawl dữ liệu từ điển từ API của TracâU và lưu chúng vào một file JSON.

## Cài đặt

1. Đảm bảo bạn đã cài đặt [Node.js](https://nodejs.org/) (phiên bản 12 trở lên)
2. Cài đặt các dependencies:

```bash
npm install
```

## Cách sử dụng

1. Chỉnh sửa danh sách từ cần tra cứu trong file `dictionary_crawler.js`:

```javascript
const wordsToFetch = ['apple', 'banana', 'orange', 'computer', 'love'];
```

2. Chạy script:

```bash
npm start
```

3. Kết quả sẽ được lưu vào file `dictionary_data.txt` dưới dạng JSON.

## Cấu trúc dữ liệu

Dữ liệu được lưu dưới dạng JSON với cấu trúc:

```javascript
{
  "word": "từ cần tra",
  "pronunciation": "phiên âm",
  "parts_of_speech": [
    {
      "type": "loại từ",
      "meanings": [
        {"definition": "nghĩa", "examples": []}
      ],
      "phrases": [
        {
          "phrase": "cụm từ",
          "meaning": "nghĩa của cụm từ",
          "examples": []
        }
      ]
    }
  ],
  "synonyms": ["từ đồng nghĩa"],
  // Thông tin chuyên ngành và khác...
}
```

## Tùy chỉnh

- Bạn có thể chỉnh sửa file `dictionary_crawler.js` để thay đổi cách phân tích HTML hoặc cấu trúc dữ liệu đầu ra.
- Để thêm chức năng xử lý HTML phức tạp hơn, bạn có thể cài đặt thêm thư viện `cheerio` với lệnh `npm install cheerio`.

## Lưu ý

Hãy sử dụng crawler này một cách hợp lý và tôn trọng các điều khoản sử dụng của TracâU. Giới hạn số lượng yêu cầu và thêm độ trễ giữa các yêu cầu để tránh quá tải máy chủ. 