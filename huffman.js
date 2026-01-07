// Global State
let state = {
    currentFile: null,
    originalText: '',
    compressedData: null,
    decompressedText: '',
    huffmanTree: null,
    huffmanCodes: {},
    frequencyMap: new Map()
};

// Utility Functions
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✓' : '✗'}</span><span>${message}</span>`;
    document.getElementById('toastContainer').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function showSpinner() {
    document.getElementById('spinner').style.display = 'flex';
}

function hideSpinner() {
    document.getElementById('spinner').style.display = 'none';
}

async function calculateHash(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Huffman Node Class
class HuffmanNode {
    constructor(char, freq, left = null, right = null) {
        this.char = char;
        this.freq = freq;
        this.left = left;
        this.right = right;
    }
}

// Huffman Algorithm
function calculateFrequencies(text) {
    const freq = new Map();
    for (const char of text) {
        freq.set(char, (freq.get(char) || 0) + 1);
    }
    return freq;
}

function buildHuffmanTree(frequencyMap) {
    const queue = Array.from(frequencyMap.entries())
        .map(([char, freq]) => new HuffmanNode(char, freq))
        .sort((a, b) => a.freq - b.freq);
    
    while (queue.length > 1) {
        queue.sort((a, b) => a.freq - b.freq);
        const left = queue.shift();
        const right = queue.shift();
        const parent = new HuffmanNode(null, left.freq + right.freq, left, right);
        queue.push(parent);
    }
    
    return queue[0];
}

function generateCodes(node, code = '', codes = {}) {
    if (!node) return codes;
    if (node.char !== null) {
        codes[node.char] = code || '0';
        return codes;
    }
    generateCodes(node.left, code + '0', codes);
    generateCodes(node.right, code + '1', codes);
    return codes;
}

function encodeText(text, codes) {
    let encoded = '';
    for (const char of text) {
        encoded += codes[char];
    }
    return encoded;
}

function decodeText(binaryData, tree) {
    let decoded = '';
    let current = tree;
    
    for (const bit of binaryData) {
        current = bit === '0' ? current.left : current.right;
        if (current.char !== null) {
            decoded += current.char;
            current = tree;
        }
    }
    
    return decoded;
}

// Serialize tree to binary (PROPERLY - no JSON!)
function serializeTreeToBinary(node) {
    const bits = [];
    
    function traverse(n) {
        if (!n) return;
        
        if (n.char !== null) {
            // Leaf node: 1 + 16-bit char code
            bits.push('1');
            const charCode = n.char.charCodeAt(0);
            bits.push(charCode.toString(2).padStart(16, '0'));
        } else {
            // Internal node: 0
            bits.push('0');
            traverse(n.left);
            traverse(n.right);
        }
    }
    
    traverse(node);
    return bits.join('');
}

// Deserialize tree from binary
function deserializeTreeFromBinary(bits, index = {i: 0}) {
    if (index.i >= bits.length) return null;
    
    const bit = bits[index.i++];
    
    if (bit === '1') {
        // Leaf node
        const charBits = bits.substr(index.i, 16);
        index.i += 16;
        const charCode = parseInt(charBits, 2);
        const char = String.fromCharCode(charCode);
        return new HuffmanNode(char, 0);
    } else {
        // Internal node
        const left = deserializeTreeFromBinary(bits, index);
        const right = deserializeTreeFromBinary(bits, index);
        return new HuffmanNode(null, 0, left, right);
    }
}

async function createBinaryFile(text, tree, codes, originalFilename) {
    // 1. Encode text to binary
    const encodedData = encodeText(text, codes);
    
    // 2. Serialize tree to binary (NO JSON!)
    const treeBinary = serializeTreeToBinary(tree);
    
    // 3. Create compact header
    const hash = await calculateHash(text);
    
    // Header format (minimal):
    // - Original filename length (1 byte)
    // - Filename (UTF-8 bytes)
    // - Tree length in bits (4 bytes = 32-bit int)
    // - Tree binary
    // - Data length in bits (4 bytes)
    // - Encoded data binary
    // - SHA-256 hash (32 bytes)
    
    const filenameBytes = new TextEncoder().encode(originalFilename);
    const hashBytes = new Uint8Array(hash.match(/.{2}/g).map(byte => parseInt(byte, 16)));
    
    // Convert binary strings to bytes
    function binaryToBytes(binStr) {
        const bytes = [];
        for (let i = 0; i < binStr.length; i += 8) {
            bytes.push(parseInt(binStr.substr(i, 8).padEnd(8, '0'), 2));
        }
        return new Uint8Array(bytes);
    }
    
    const treeBytes = binaryToBytes(treeBinary);
    const dataBytes = binaryToBytes(encodedData);
    
    // Calculate total size
    const totalSize = 1 + filenameBytes.length + 4 + treeBytes.length + 4 + dataBytes.length + 4 + 4 + hashBytes.length;
    const buffer = new Uint8Array(totalSize);
    const view = new DataView(buffer.buffer);
    
    let offset = 0;
    
    // Write filename length (1 byte)
    buffer[offset++] = filenameBytes.length;
    
    // Write filename
    buffer.set(filenameBytes, offset);
    offset += filenameBytes.length;
    
    // Write tree length in bits (4 bytes)
    view.setUint32(offset, treeBinary.length, false);
    offset += 4;
    
    // Write tree
    buffer.set(treeBytes, offset);
    offset += treeBytes.length;
    
    // Write data length in bits (4 bytes)
    view.setUint32(offset, encodedData.length, false);
    offset += 4;
    
    // Write encoded data
    buffer.set(dataBytes, offset);
    offset += dataBytes.length;
    
    // Write original text length (4 bytes)
    view.setUint32(offset, text.length, false);
    offset += 4;
    
    // Write hash
    buffer.set(hashBytes, offset);
    
    return new Blob([buffer], { type: 'application/octet-stream' });
}

async function readBinaryFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const buffer = new Uint8Array(e.target.result);
                const view = new DataView(buffer.buffer);
                let offset = 0;
                
                // Read filename length
                const filenameLength = buffer[offset++];
                
                // Read filename
                const filenameBytes = buffer.slice(offset, offset + filenameLength);
                const filename = new TextDecoder().decode(filenameBytes);
                offset += filenameLength;
                
                // Read tree length
                const treeLengthBits = view.getUint32(offset, false);
                offset += 4;
                
                // Read tree bytes and convert to binary string
                const treeBytesLength = Math.ceil(treeLengthBits / 8);
                const treeBytes = buffer.slice(offset, offset + treeBytesLength);
                let treeBinary = '';
                for (let i = 0; i < treeBytes.length; i++) {
                    treeBinary += treeBytes[i].toString(2).padStart(8, '0');
                }
                treeBinary = treeBinary.substr(0, treeLengthBits); // Trim to exact length
                offset += treeBytesLength;
                
                // Read data length
                const dataLengthBits = view.getUint32(offset, false);
                offset += 4;
                
                // Read data bytes and convert to binary string
                const dataBytesLength = Math.ceil(dataLengthBits / 8);
                const dataBytes = buffer.slice(offset, offset + dataBytesLength);
                let dataBinary = '';
                for (let i = 0; i < dataBytes.length; i++) {
                    dataBinary += dataBytes[i].toString(2).padStart(8, '0');
                }
                dataBinary = dataBinary.substr(0, dataLengthBits); // Trim to exact length
                offset += dataBytesLength;
                
                // Read original size
                const originalSize = view.getUint32(offset, false);
                offset += 4;
                
                // Read hash
                const hashBytes = buffer.slice(offset, offset + 32);
                const hash = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
                
                // Deserialize tree
                const tree = deserializeTreeFromBinary(treeBinary);
                
                resolve({
                    metadata: {
                        filename: filename,
                        hash: hash,
                        originalSize: originalSize,
                        binaryLength: dataLengthBits
                    },
                    tree: tree,
                    binaryData: dataBinary
                });
            } catch (error) {
                reject(new Error('Invalid or corrupted .bin file: ' + error.message));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}
// ENCODE TAB - File Upload Handlers
function setupEncodeUpload() {
    const dropzone = document.getElementById('encodeDropzone');
    const fileInput = document.getElementById('encodeFileInput');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        handleEncodeFile(file);
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleEncodeFile(file);
    });
}

function handleEncodeFile(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.txt')) {
        showToast('Please upload a .txt file', 'error');
        return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
        showToast('File too large. Maximum size is 10MB', 'error');
        return;
    }
    
    state.currentFile = file;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        state.originalText = e.target.result;
        showEncodePreview();
    };
    reader.readAsText(file);
}

function showEncodePreview() {
    // Hide upload, show preview
    document.getElementById('encodeUploadContainer').style.display = 'none';
    document.getElementById('encodePreviewContainer').style.display = 'block';
    
    // Fill in file info
    document.getElementById('encodeFileName').textContent = state.currentFile.name;
    document.getElementById('encodeFileMeta').textContent = 
        `${formatBytes(state.currentFile.size)} • ${state.originalText.length} characters`;
    
    // Show content
    document.getElementById('encodeFileContent').textContent = state.originalText;
}

function clearEncodeFile() {
    state.currentFile = null;
    state.originalText = '';
    document.getElementById('encodeFileInput').value = '';
    document.getElementById('encodeUploadContainer').style.display = 'block';
    document.getElementById('encodePreviewContainer').style.display = 'none';
    document.getElementById('encodeSplitContainer').style.display = 'none';
    document.getElementById('encodeResultsContainer').style.display = 'none';
}

async function compressFile() {
    if (!state.originalText) return;
    
    showSpinner();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const startTime = performance.now();
        
        state.frequencyMap = calculateFrequencies(state.originalText);
        state.huffmanTree = buildHuffmanTree(state.frequencyMap);
        state.huffmanCodes = generateCodes(state.huffmanTree);
        state.compressedData = await createBinaryFile(
            state.originalText,
            state.huffmanTree,
            state.huffmanCodes,
            state.currentFile.name
        );
        
        const endTime = performance.now();
        const processingTime = Math.round(endTime - startTime);
        
        showCompressionResults(processingTime);
        hideSpinner();
        showToast('File compressed successfully!');
        
    } catch (error) {
        hideSpinner();
        showToast('Compression failed: ' + error.message, 'error');
    }
}

function showCompressionResults(processingTime) {
    const originalSize = new Blob([state.originalText]).size;
    const compressedSize = state.compressedData.size;
    const compressionRatio = ((compressedSize / originalSize) * 100).toFixed(2);
    const spaceSaved = (100 - compressionRatio).toFixed(2);
    
    // Hide preview, show split view
    document.getElementById('encodePreviewContainer').style.display = 'none';
    document.getElementById('encodeSplitContainer').style.display = 'grid';
    
    // Fill split panels
    document.getElementById('encodeOriginalSize').textContent = formatBytes(originalSize);
    document.getElementById('encodeCompressedSize').textContent = formatBytes(compressedSize);
    document.getElementById('encodeOriginalContent').textContent = state.originalText;
    
    // Show FULL PURE BINARY (all 0s and 1s) - NO TRUNCATION
    const fullBinary = encodeText(state.originalText, state.huffmanCodes);
    document.getElementById('encodeBinaryContent').textContent = fullBinary;
    
    // Show results
    document.getElementById('encodeResultsContainer').style.display = 'block';
    
    // Fill stats
    document.getElementById('statOriginalSize').textContent = formatBytes(originalSize);
    document.getElementById('statCompressedSize').textContent = formatBytes(compressedSize);
    document.getElementById('statCompressionRatio').textContent = compressionRatio + '%';
    document.getElementById('statSpaceSaved').textContent = spaceSaved + '%';
    document.getElementById('statUniqueChars').textContent = state.frequencyMap.size;
    document.getElementById('statProcessingTime').textContent = processingTime + ' ms';
}

function downloadCompressedFile() {
    if (!state.compressedData) return;
    
    const url = URL.createObjectURL(state.compressedData);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.currentFile.name.replace('.txt', '.bin');
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Binary file downloaded!');
}

// DECODE TAB - File Upload Handlers
function setupDecodeUpload() {
    const dropzone = document.getElementById('decodeDropzone');
    const fileInput = document.getElementById('decodeFileInput');
    
    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const file = e.dataTransfer.files[0];
        handleDecodeFile(file);
    });
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        handleDecodeFile(file);
    });
}

async function handleDecodeFile(file) {
    if (!file) return;
    
    if (!file.name.endsWith('.bin')) {
        showToast('Please upload a .bin file', 'error');
        return;
    }
    
    state.currentFile = file;
    
    // Read and show FULL PURE BINARY (0s and 1s)
    try {
        const { binaryData } = await readBinaryFile(file);
        showDecodePreview(binaryData);
    } catch (error) {
        showToast('Error reading file: ' + error.message, 'error');
    }
}

function showDecodePreview(binaryContent) {
    document.getElementById('decodeUploadContainer').style.display = 'none';
    document.getElementById('decodePreviewContainer').style.display = 'block';
    
    document.getElementById('decodeFileName').textContent = state.currentFile.name;
    document.getElementById('decodeFileMeta').textContent = formatBytes(state.currentFile.size);
    
    // Show FULL pure binary (0s and 1s) - ALL of it
    document.getElementById('decodeFileContent').textContent = binaryContent;
}

function clearDecodeFile() {
    state.currentFile = null;
    state.decompressedText = '';
    document.getElementById('decodeFileInput').value = '';
    document.getElementById('decodeUploadContainer').style.display = 'block';
    document.getElementById('decodePreviewContainer').style.display = 'none';
    document.getElementById('decodeSplitContainer').style.display = 'none';
    document.getElementById('decodeResultsContainer').style.display = 'none';
}

async function decompressFile() {
    if (!state.currentFile) return;
    
    showSpinner();
    await new Promise(resolve => setTimeout(resolve, 100));
    
    try {
        const { metadata, tree, binaryData } = await readBinaryFile(state.currentFile);
        // Tree is already deserialized from binary format
        const binaryString = binaryData.substring(0, metadata.binaryLength);
        state.decompressedText = decodeText(binaryString, tree);
        state.binaryString = binaryString; // Store for display
        
        const currentHash = await calculateHash(state.decompressedText);
        const hashMatch = currentHash === metadata.hash;
        const sizeMatch = state.decompressedText.length === metadata.originalSize;
        
        showDecompressionResults(metadata, hashMatch, sizeMatch);
        hideSpinner();
        showToast('File decompressed successfully!');
        
    } catch (error) {
        hideSpinner();
        showToast('Decompression failed: ' + error.message, 'error');
    }
}

function showDecompressionResults(metadata, hashMatch, sizeMatch) {
    document.getElementById('decodePreviewContainer').style.display = 'none';
    document.getElementById('decodeSplitContainer').style.display = 'grid';
    
    document.getElementById('decodeBinarySize').textContent = formatBytes(state.currentFile.size);
    document.getElementById('decodeDecompressedSize').textContent = 
        formatBytes(state.decompressedText.length);
    
    // LEFT PANEL: Show ONLY pure binary data
    document.getElementById('decodeMetadata').innerHTML = `
        <pre style="font-family: 'Courier New', monospace; font-size: 0.75rem; line-height: 1.6; overflow-y: auto; height: 500px; overflow-x: hidden; white-space: pre-wrap; word-wrap: break-word; margin: 0; padding: 1rem;">${state.binaryString}</pre>
    `;
    
    // RIGHT PANEL: Decompressed content
    document.getElementById('decodeDecompressedContent').textContent = state.decompressedText;
    
    // Show results section with all the info
    document.getElementById('decodeResultsContainer').style.display = 'block';
    
    // Create info section
    const infoHtml = `
        <div style="background: var(--bg-secondary); border: 1px solid var(--border-color); padding: 1.5rem; margin-bottom: 1.5rem;">
            <h3 style="font-family: var(--font-display); font-size: 1.2rem; color: var(--rose-pink); margin-bottom: 1rem;">File Information</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                <div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.25rem;">Filename</p>
                    <p style="color: var(--text-primary); font-weight: 600;">${metadata.filename}</p>
                </div>
                <div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.25rem;">Original Size</p>
                    <p style="color: var(--text-primary); font-weight: 600;">${metadata.originalSize} characters</p>
                </div>
                <div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.25rem;">Binary Length</p>
                    <p style="color: var(--text-primary); font-weight: 600;">${metadata.binaryLength} bits</p>
                </div>
                <div>
                    <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 0.25rem;">Compressed Size</p>
                    <p style="color: var(--text-primary); font-weight: 600;">${formatBytes(state.currentFile.size)}</p>
                </div>
            </div>
            
            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <h4 style="color: var(--rose-pink); margin-bottom: 0.75rem; font-size: 1rem;">Verification</h4>
                <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                    <div class="verify-badge ${hashMatch ? 'success' : 'error'}">
                        ${hashMatch ? '✓ Hash Match' : '✗ Hash Mismatch'}
                    </div>
                    <div class="verify-badge ${sizeMatch ? 'success' : 'error'}">
                        ${sizeMatch ? '✓ Size Match' : '✗ Size Mismatch'}
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 1rem;">
                <p style="color: var(--text-secondary); font-size: 0.8rem;">SHA-256: <code style="font-family: 'Courier New', monospace; color: var(--text-primary);">${metadata.hash}</code></p>
            </div>
        </div>
    `;
    
    // Insert info before download button
    const resultsContainer = document.getElementById('decodeResultsContainer');
    const existingInfo = resultsContainer.querySelector('.decode-info-section');
    if (existingInfo) {
        existingInfo.remove();
    }
    
    const infoDiv = document.createElement('div');
    infoDiv.className = 'decode-info-section';
    infoDiv.innerHTML = infoHtml;
    resultsContainer.insertBefore(infoDiv, resultsContainer.querySelector('.btn-download'));
}

function downloadDecompressedFile() {
    if (!state.decompressedText) return;
    
    const blob = new Blob([state.decompressedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = state.currentFile.name.replace('.bin', '.txt');
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Text file downloaded!');
}

// Tab Switching
function setupTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === targetTab) {
                    content.classList.add('active');
                }
            });
        });
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    setupEncodeUpload();
    setupDecodeUpload();
    
    document.getElementById('encodeClearBtn').addEventListener('click', clearEncodeFile);
    document.getElementById('compressBtn').addEventListener('click', compressFile);
    document.getElementById('downloadCompressedBtn').addEventListener('click', downloadCompressedFile);
    
    document.getElementById('decodeClearBtn').addEventListener('click', clearDecodeFile);
    document.getElementById('decompressBtn').addEventListener('click', decompressFile);
    document.getElementById('downloadDecompressedBtn').addEventListener('click', downloadDecompressedFile);
    
    console.log('Huffman Codec initialized!');
});

// Visualization Functions
function showModal(title, content) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = content;
    document.getElementById('modal').classList.add('active');
}

function closeModal() {
    document.getElementById('modal').classList.remove('active');
}

document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
});

// Frequency Table
document.getElementById('viewFreqBtn').addEventListener('click', () => {
    const sortedFreq = Array.from(state.frequencyMap.entries())
        .sort((a, b) => b[1] - a[1]);
    
    const totalChars = state.originalText.length;
    
    let tableHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Character</th>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Frequency</th>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Percentage</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedFreq.forEach(([char, freq]) => {
        const percentage = ((freq / totalChars) * 100).toFixed(2);
        const displayChar = char === ' ' ? '(space)' : char === '\n' ? '(newline)' : char;
        tableHtml += `
            <tr style="border-bottom: 1px solid rgba(200, 162, 208, 0.2);">
                <td style="padding: 0.5rem; font-family: 'Courier New', monospace; color: var(--accent-pink);">${displayChar}</td>
                <td style="padding: 0.5rem;">${freq}</td>
                <td style="padding: 0.5rem;">${percentage}%</td>
            </tr>
        `;
    });
    
    tableHtml += `</tbody></table>`;
    showModal('FREQUENCY TABLE', tableHtml);
});

// Huffman Codes
document.getElementById('viewCodesBtn').addEventListener('click', () => {
    const sortedCodes = Object.entries(state.huffmanCodes)
        .sort((a, b) => a[1].length - b[1].length);
    
    let tableHtml = `
        <table style="width: 100%; border-collapse: collapse;">
            <thead>
                <tr>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Character</th>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Huffman Code</th>
                    <th style="text-align: left; padding: 0.5rem; border-bottom: 2px solid var(--rose-pink);">Length</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    sortedCodes.forEach(([char, code]) => {
        const displayChar = char === ' ' ? '(space)' : char === '\n' ? '(newline)' : char;
        tableHtml += `
            <tr style="border-bottom: 1px solid rgba(200, 162, 208, 0.2);">
                <td style="padding: 0.5rem; font-family: 'Courier New', monospace; color: var(--accent-pink);">${displayChar}</td>
                <td style="padding: 0.5rem; font-family: 'Courier New', monospace; color: var(--lavender);">${code}</td>
                <td style="padding: 0.5rem;">${code.length}</td>
            </tr>
        `;
    });
    
    tableHtml += `</tbody></table>`;
    showModal('HUFFMAN CODES', tableHtml);
});

// Chart
document.getElementById('viewChartBtn').addEventListener('click', () => {
    const originalSize = new Blob([state.originalText]).size;
    const compressedSize = state.compressedData.size;
    const originalPercent = 100;
    const compressedPercent = (compressedSize / originalSize) * 100;
    
    const chartHtml = `
        <div style="padding: 2rem;">
            <div style="margin-bottom: 2rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Original Size</span>
                    <span>${formatBytes(originalSize)}</span>
                </div>
                <div style="background: rgba(255, 179, 217, 0.1); height: 40px; position: relative;">
                    <div style="width: ${originalPercent}%; height: 100%; background: linear-gradient(90deg, var(--rose-pink), var(--soft-purple)); display: flex; align-items: center; padding-left: 1rem; color: #1a1625; font-weight: 600;">
                        ${originalPercent}%
                    </div>
                </div>
            </div>
            <div>
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Compressed Size</span>
                    <span>${formatBytes(compressedSize)}</span>
                </div>
                <div style="background: rgba(255, 179, 217, 0.1); height: 40px; position: relative;">
                    <div style="width: ${compressedPercent}%; height: 100%; background: linear-gradient(90deg, var(--rose-pink), var(--soft-purple)); display: flex; align-items: center; padding-left: 1rem; color: #1a1625; font-weight: 600;">
                        ${compressedPercent.toFixed(2)}%
                    </div>
                </div>
            </div>
        </div>
    `;
    
    showModal('COMPRESSION CHART', chartHtml);
});

// Report
document.getElementById('viewReportBtn').addEventListener('click', () => {
    const originalSize = new Blob([state.originalText]).size;
    const compressedSize = state.compressedData.size;
    const compressionRatio = ((compressedSize / originalSize) * 100).toFixed(2);
    const spaceSaved = (100 - compressionRatio).toFixed(2);
    const timestamp = new Date().toLocaleString();
    
    const reportHtml = `
        <div style="line-height: 1.8;">
            <h3 style="color: var(--rose-pink); margin: 1.5rem 0 1rem 0; font-family: var(--font-display);">STUDENT INFORMATION</h3>
            <p><strong style="color: var(--accent-pink);">Name:</strong> Zahra Barakat</p>
            <p><strong style="color: var(--accent-pink);">Student ID:</strong> F23040129</p>
            <p><strong style="color: var(--accent-pink);">Project:</strong> Huffman Coding - Lossless Data Compression</p>
            
            <h3 style="color: var(--rose-pink); margin: 1.5rem 0 1rem 0; font-family: var(--font-display);">FILE INFORMATION</h3>
            <p><strong style="color: var(--accent-pink);">Filename:</strong> ${state.currentFile.name}</p>
            <p><strong style="color: var(--accent-pink);">Original Size:</strong> ${formatBytes(originalSize)}</p>
            <p><strong style="color: var(--accent-pink);">Compressed Size:</strong> ${formatBytes(compressedSize)}</p>
            <p><strong style="color: var(--accent-pink);">Character Count:</strong> ${state.originalText.length}</p>
            <p><strong style="color: var(--accent-pink);">Unique Characters:</strong> ${state.frequencyMap.size}</p>
            
            <h3 style="color: var(--rose-pink); margin: 1.5rem 0 1rem 0; font-family: var(--font-display);">COMPRESSION STATISTICS</h3>
            <p><strong style="color: var(--accent-pink);">Compression Ratio:</strong> ${compressionRatio}%</p>
            <p><strong style="color: var(--accent-pink);">Space Saved:</strong> ${spaceSaved}%</p>
            <p><strong style="color: var(--accent-pink);">Bytes Saved:</strong> ${formatBytes(originalSize - compressedSize)}</p>
            
            <h3 style="color: var(--rose-pink); margin: 1.5rem 0 1rem 0; font-family: var(--font-display);">ALGORITHM DETAILS</h3>
            <p><strong style="color: var(--accent-pink);">Algorithm:</strong> Huffman Coding</p>
            <p><strong style="color: var(--accent-pink);">Time Complexity:</strong> O(n log k)</p>
            <p><strong style="color: var(--accent-pink);">Space Complexity:</strong> O(k)</p>
            <p><strong style="color: var(--accent-pink);">Encoding Type:</strong> Variable-length prefix coding</p>
            <p><strong style="color: var(--accent-pink);">Data Loss:</strong> None (lossless compression)</p>
            
            <h3 style="color: var(--rose-pink); margin: 1.5rem 0 1rem 0; font-family: var(--font-display);">TIMESTAMP</h3>
            <p><strong style="color: var(--accent-pink);">Generated:</strong> ${timestamp}</p>
        </div>
    `;
    
    showModal('COMPRESSION REPORT', reportHtml);
});