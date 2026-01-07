# 📦 Huffman Encoder/Decoder Web Application

A beautiful, fully-functional web application for file compression and decompression using Huffman Coding algorithm. Built with vanilla JavaScript, HTML5, and CSS3.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow.svg)
![HTML5](https://img.shields.io/badge/HTML-5-orange.svg)
![CSS3](https://img.shields.io/badge/CSS-3-blue.svg)

## 👨‍🎓 Project Information

- **Student Name:** Zahra Barakat
- **Student ID:** F23040129
- **Institution:** Nanjing University of Posts and Telecommunications (NJUPT)
- **Course:** Data Structures & Algorithms
- **Project:** Huffman Coding Implementation

## ✨ Features

### Core Functionality
- ✅ **File Compression** - Compress `.txt` files using Huffman coding algorithm
- ✅ **File Decompression** - Decompress `.bin` files back to original text
- ✅ **Binary Encoding** - Proper binary representation with packed bytes (NOT stored as text)
- ✅ **Tree Serialization** - Efficient binary tree storage in compressed files
- ✅ **Data Integrity** - SHA-256 hash verification for compressed/decompressed files

### User Interface
- 🎨 **Elegant Design** - Soft pink and purple color scheme with smooth animations
- 📊 **Real-time Statistics** - Compression ratio, space saved, processing time
- 👁️ **Binary Visualization** - View pure binary (0s and 1s) or hexadecimal representation
- 📈 **Multiple Views** - Frequency tables, Huffman codes, compression charts, detailed reports
- 📱 **Responsive Design** - Works on desktop, tablet, and mobile devices

### Advanced Features
- 🔄 **Split View** - Compare original and compressed files side-by-side
- 🔍 **Binary/Hex Toggle** - Switch between binary and hexadecimal views
- 💾 **Custom Binary Format** - Efficient file format with minimal overhead
- ⚡ **Fast Processing** - Optimized algorithms for quick compression/decompression
- 🎯 **Drag & Drop** - Easy file upload with drag-and-drop support

## 🚀 Quick Start

### Running Locally

1. **Clone the repository**
```bash
git clone https://github.com/YOUR_USERNAME/huffman-codec-project.git
cd huffman-codec-project
```

2. **Open in browser**
```bash
# Option 1: Double-click index.html
# Option 2: Use a local server (recommended)
python -m http.server 8000
# Then open http://localhost:8000
```

3. **Try it out**
- Upload `test.txt` or `long_test.txt` in the Compress tab
- Download the `.bin` file
- Upload the `.bin` file in the Decompress tab
- Verify the decompressed text matches the original!

## 📚 How It Works

### Huffman Coding Algorithm

Huffman coding is a **lossless data compression** algorithm that assigns variable-length codes to characters based on their frequency of occurrence.

#### Steps:
1. **Calculate Frequencies** - Count how often each character appears
2. **Build Huffman Tree** - Create a binary tree using a greedy algorithm
3. **Generate Codes** - Assign binary codes based on tree paths (left=0, right=1)
4. **Encode Text** - Replace each character with its Huffman code
5. **Pack into Bytes** - Convert binary string to actual bytes for storage

### Example

**Input:** `"hello"`

**Character Frequencies:**
- h: 1
- e: 1
- l: 2
- o: 1

**Huffman Tree:**
```
        [5]
       /   \
     [2]   [3]
    / \    / \
  [h] [e] [l] [o]
```

**Generated Codes:**
- h = 00
- e = 01
- l = 10
- o = 11

**Encoded:** `"hello"` → `00 01 10 10 11` → `0001101011` (10 bits vs 40 bits original)

**Compression Ratio:** 75% smaller!

## 🗂️ File Structure

```
huffman-codec-project/
├── index.html          # Main HTML structure
├── styles.css          # Elegant feminine theme styling
├── huffman.js          # Core Huffman algorithm implementation
├── test.txt            # Small test file (1.8 KB)
├── long_test.txt       # Larger test file (7.5 KB)
└── README.md           # This file
```

## 💻 Code Overview

### Key Functions

#### 1. **buildHuffmanTree()** - Lines 64-78
Builds the Huffman tree using a greedy algorithm by repeatedly combining the two nodes with smallest frequencies.

```javascript
function buildHuffmanTree(frequencyMap) {
    // Create leaf nodes and sort by frequency
    const queue = Array.from(frequencyMap.entries())
        .map(([char, freq]) => new HuffmanNode(char, freq))
        .sort((a, b) => a.freq - b.freq);
    
    // Combine smallest nodes until one remains
    while (queue.length > 1) {
        const left = queue.shift();
        const right = queue.shift();
        const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
        queue.push(parent);
    }
    
    return queue[0]; // Root
}
```

#### 2. **generateCodes()** - Lines 80-89
Recursively generates Huffman codes by traversing the tree (left=0, right=1).

#### 3. **encodeText()** - Lines 91-97
Converts text to binary by replacing each character with its Huffman code.

#### 4. **decodeText()** - Lines 99-112
Decodes binary back to text by traversing the tree based on each bit.

#### 5. **serializeTreeToBinary()** - Lines 115-136
Serializes the Huffman tree to a compact binary format for storage.

#### 6. **Binary Packing** - Line 185
**CRITICAL:** Converts binary string to actual bytes (NOT text)
```javascript
bytes.push(parseInt(binStr.substr(i, 8).padEnd(8, '0'), 2));
```
This line proves we're using **real binary encoding**, not storing '0' and '1' as text characters!

### Binary File Format

```
[1 byte: filename length]
[variable: filename in UTF-8]
[4 bytes: tree length in bits]
[variable: serialized Huffman tree]
[4 bytes: encoded data length in bits]
[variable: compressed data]
[4 bytes: original text size]
[32 bytes: SHA-256 hash]
```

## 📊 Performance

### Compression Ratios (typical)

| File Type | Compression Ratio | Space Saved |
|-----------|------------------|-------------|
| English text | 50-60% | 40-50% |
| Repetitive text | 20-40% | 60-80% |
| Random/encrypted | 95-105% | 0-5% |

### Example Results

**File:** `long_test.txt` (7,513 bytes)
- **Compressed:** ~3,800-4,200 bytes
- **Compression Ratio:** ~52%
- **Space Saved:** ~48%

## 🎯 Algorithm Complexity

- **Time Complexity:** O(n log k)
  - n = text length
  - k = unique characters (typically ≤ 256)
- **Space Complexity:** O(k)
  - Storage for tree, codes, and frequency map

## 🔍 Technical Highlights

### Why This Implementation is Correct

1. ✅ **Binary Representation** - Uses actual binary encoding, not text
2. ✅ **Prefix-Free Codes** - Huffman codes guarantee unambiguous decoding
3. ✅ **Lossless Compression** - Perfect reconstruction of original data
4. ✅ **Efficient Tree Storage** - Binary serialization instead of JSON
5. ✅ **Data Verification** - SHA-256 hash ensures integrity

### Proof of Binary Encoding

**Wrong Way (storing as text):**
```javascript
let file = new Blob(["01011001"]); // 8 bytes
```
Stores characters '0','1','0','1','1','0','0','1' = 8 × 8 = 64 bits

**Our Way (actual binary):**
```javascript
let byte = parseInt("01011001", 2); // = 89
let file = new Blob([new Uint8Array([byte])]); // 1 byte
```
Stores number 89 as one byte = 8 bits ✅

**Result:** 8× more efficient!

## 🎓 Educational Value

This project demonstrates:
- **Data Structures:** Binary trees, priority queues, hash maps
- **Algorithms:** Greedy algorithms, tree traversal, recursion
- **File I/O:** Binary file handling, byte manipulation
- **Web Development:** Modern JavaScript, responsive CSS, user experience design
- **Software Engineering:** Clean code, modular design, error handling

## 🛠️ Technologies Used

- **JavaScript ES6+** - Core algorithm implementation
- **HTML5** - Semantic markup and structure
- **CSS3** - Custom styling with CSS Grid and Flexbox
- **Web APIs** - FileReader, Blob, TextEncoder/Decoder, Crypto (SHA-256)
- **Google Fonts** - Playfair Display & Inter

## 📖 Resources

### Learn More About Huffman Coding
- [Wikipedia - Huffman Coding](https://en.wikipedia.org/wiki/Huffman_coding)
- [Visualization Tool](https://www.cs.usfca.edu/~galles/visualization/Huffman.html)
- [Original Paper by David A. Huffman (1952)](https://compression.ru/download/articles/huff/huffman_1952_minimum-redundancy-codes.pdf)

### Related Topics
- **Arithmetic Coding** - More efficient than Huffman for some data
- **LZ77/LZ78** - Dictionary-based compression (used in ZIP)
- **DEFLATE** - Combines Huffman + LZ77 (used in gzip)

## 🤝 Contributing

This is a student project, but suggestions and improvements are welcome!

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/improvement`)
3. Commit your changes (`git commit -am 'Add improvement'`)
4. Push to the branch (`git push origin feature/improvement`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](#) file for details.

## 👤 Author

**Badr** (Developer)
- Collaborated with Zahra Barakat on this academic project
- GitHub: [@YOUR_USERNAME](https://github.com/YOUR_USERNAME)

## 🙏 Acknowledgments

- NJUPT Computer Science Department
- Course instructors for project guidance
- David A. Huffman for the algorithm (1952)

## 📧 Contact

For questions or feedback about this project:
- Open an issue on GitHub
- Email: [your-email@example.com]

---

**⭐ If you found this project helpful, please consider giving it a star!**

Made with 💖 for learning and education
