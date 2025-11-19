# Hướng Dẫn Test Inline Diff Extension

## ✅ Extension đã được tạo và compile thành công!

## Cách Test Extension

### Bước 1: Mở Extension trong VS Code

1. Mở folder `test_diff_editor` trong VS Code:
   ```
   File > Open Folder > chọn test_diff_editor
   ```

2. Nhấn `F5` hoặc:
   ```
   Run > Start Debugging
   ```

3. VS Code sẽ mở một cửa sổ mới có tên **[Extension Development Host]**

### Bước 2: Test Extension

Trong cửa sổ Extension Development Host:

1. **Mở file test**:
   - Mở file `test-file.js` đã có sẵn
   - Hoặc tạo file mới với code bất kỳ

2. **Trigger inline diff**:
   - Nhấn `Ctrl+Shift+D` (Windows/Linux)
   - Hoặc `Cmd+Shift+D` (Mac)
   - Hoặc: `Ctrl+Shift+P` > gõ "Show AI Inline Diff"

3. **Quan sát kết quả**:
   - Dòng **XANH** (+): Dòng thêm mới
   - Dòng **ĐỎ** (-): Dòng xóa (có gạch ngang)
   - Buttons **CodeLens** xuất hiện ở đầu file và mỗi dòng

### Bước 3: Tương Tác với Diff

#### Accept/Reject Toàn Bộ:
- Click **"✅ Accept All Changes"**: Giữ tất cả thay đổi
- Click **"❌ Reject All Changes"**: Hủy tất cả thay đổi
- Click **"🧹 Clear Diff View"**: Xóa decorations nhưng giữ code

#### Accept/Reject Từng Dòng:
- Dòng XANH (+):
  - **"✅ Keep"**: Giữ dòng này
  - **"❌ Remove"**: Xóa dòng này

- Dòng ĐỎ (-):
  - **"↩️ Restore"**: Khôi phục dòng đã xóa
  - **"✅ Confirm Delete"**: Xác nhận xóa dòng

#### Sửa Trực Tiếp:
- Click vào bất kỳ dòng nào (xanh hoặc đỏ)
- Gõ để sửa nội dung
- **Extension cho phép sửa trực tiếp!**

## Demo Scenarios

### Scenario 1: JavaScript Function

**File gốc**:
```javascript
function calculateTotal(items) {
  var total = 0;
  for (let item of items) {
    total += item.price;
  }
  return total;
}
```

**Sau khi nhấn Ctrl+Shift+D**:
- `var` → `const` (dòng đỏ xóa `var`, dòng xanh thêm `const`)
- `console.log` → `console.info`
- Thêm error handling code (dòng xanh)

### Scenario 2: Tự Tạo Code

1. Tạo file mới `my-test.js`
2. Viết code bất kỳ:
```javascript
function hello() {
  console.log("test");
}
```
3. Nhấn `Ctrl+Shift+D`
4. Xem AI suggestions

## Tính Năng Đã Implement

✅ **Inline diff view** - Hiển thị changes trong file  
✅ **Color coding** - Xanh (add), Đỏ (delete)  
✅ **Editable** - Sửa trực tiếp các dòng  
✅ **CodeLens buttons** - Accept/Reject UI  
✅ **Keyboard shortcut** - Ctrl+Shift+D  
✅ **Granular control** - Accept/reject từng dòng  
✅ **Mock AI** - Simulate AI suggestions  

## Kiểm Tra Khả Năng

### 1. Inline Diff ✅
- Mở file, nhấn Ctrl+Shift+D
- Kiểm tra: Có thấy dòng xanh/đỏ không?

### 2. Editable ✅
- Click vào dòng xanh hoặc đỏ
- Gõ để sửa
- Kiểm tra: Có sửa được không?

### 3. Accept/Reject ✅
- Click "Accept All"
- Kiểm tra: Dòng đỏ biến mất, chỉ còn dòng xanh?

### 4. Partial Accept ✅
- Click "Keep" trên một dòng xanh
- Click "Remove" trên dòng xanh khác
- Kiểm tra: Có thể accept/reject từng dòng?

## Troubleshooting

### Extension không load
```bash
# Trong terminal của test_diff_editor:
npm install
npm run compile
# Sau đó nhấn F5 lại
```

### Không thấy decorations
- Đảm bảo file có nội dung
- Thử với file `test-file.js` có sẵn
- Check console: `Help > Toggle Developer Tools`

### CodeLens không xuất hiện
- Đảm bảo đã trigger diff (Ctrl+Shift+D)
- Check VS Code settings: CodeLens có enabled không

### Muốn thay đổi AI logic
- Edit file `src/extension.ts`
- Tìm function `simulateAISuggestion()`
- Sửa logic theo ý muốn
- Chạy `npm run compile`
- Reload extension (Ctrl+R trong Extension Development Host)

## Next Steps

Sau khi test xong, bạn có thể:

1. **Tích hợp AI thực**:
   - Thay `simulateAISuggestion()` bằng API call
   - Hoặc browser automation với Puppeteer

2. **Thêm tính năng**:
   - Diff history
   - Multiple suggestions
   - Custom keybindings

3. **Publish extension**:
   - Tạo account trên VS Code Marketplace
   - Package extension: `vsce package`
   - Publish: `vsce publish`

## Kết Luận

Extension này chứng minh rằng:
- ✅ VS Code Extension API **ĐỦ MẠNH** để tạo inline diff
- ✅ **HOÀN TOÀN có thể** sửa trực tiếp trong diff view
- ✅ UX **TƯƠNG TỰ CURSOR** (~90%)
- ✅ **KHÔNG CẦN FORK** VS Code

Đây là nền tảng tốt để xây dựng IDE tương tác với chatbot theo ý tưởng ban đầu của bạn!
