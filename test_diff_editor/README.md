# Inline Diff Demo Extension

Extension demo để hiển thị AI suggestions dưới dạng inline diff với khả năng edit trực tiếp.

## Tính Năng

- ✅ **Inline diff view**: Hiển thị changes trực tiếp trong file
- 🟢 **Dòng xanh (+)**: Thêm mới
- 🔴 **Dòng đỏ (-)**: Xóa bỏ (strikethrough)
- ✏️ **Editable**: Sửa trực tiếp các dòng trong file
- 🎯 **Accept/Reject**: Từng dòng hoặc tất cả
- ⌨️ **Keyboard shortcut**: `Ctrl+Shift+D` (hoặc `Cmd+Shift+D` trên Mac)

## Cách Sử Dụng

### 1. Cài Đặt Dependencies

```bash
npm install
```

### 2. Compile TypeScript

```bash
npm run compile
```

### 3. Chạy Extension

Trong VS Code:
- Nhấn `F5` để mở Extension Development Host
- Hoặc: Run > Start Debugging

### 4. Test Extension

1. Trong Extension Development Host, tạo một file mới (ví dụ: `test.js`)
2. Viết một số code:

```javascript
function hello() {
  var name = "World";
  console.log("Hello " + name);
}
```

3. Nhấn `Ctrl+Shift+D` (hoặc mở Command Palette và chọn "Show AI Inline Diff (Demo)")
4. Extension sẽ hiển thị AI suggestions với inline diff
5. Bạn sẽ thấy:
   - Dòng đỏ (-): Dòng bị xóa (với strikethrough)
   - Dòng xanh (+): Dòng thêm mới
   - CodeLens buttons: Accept/Reject

### 5. Tương Tác với Diff

- **Accept All**: Click button "✅ Accept All Changes"
- **Reject All**: Click button "❌ Reject All Changes"
- **Accept/Reject từng dòng**: Click buttons bên cạnh mỗi dòng
- **Sửa trực tiếp**: Click vào dòng và edit như bình thường
- **Clear diff view**: Click "🧹 Clear Diff View"

## Cấu Trúc Code

```
src/
├── extension.ts          # Entry point, đăng ký commands
├── diffManager.ts        # Quản lý diff state và operations
├── decorations.ts        # Decoration styles (xanh/đỏ/vàng)
├── codeLensProvider.ts   # CodeLens cho Accept/Reject buttons
└── diffComputer.ts       # Compute line diff algorithm
```

## Commands

- `inline-diff.showDiff`: Hiển thị inline diff (Ctrl+Shift+D)
- `inline-diff.acceptAll`: Accept tất cả changes
- `inline-diff.rejectAll`: Reject tất cả changes
- `inline-diff.clearDiff`: Clear diff view
- `inline-diff.acceptLine`: Accept một dòng
- `inline-diff.rejectLine`: Reject một dòng
- `inline-diff.restoreLine`: Restore dòng đã xóa
- `inline-diff.confirmDelete`: Confirm xóa dòng

## Mock AI Suggestion

Hiện tại extension sử dụng mock AI suggestion function trong `extension.ts`:
- Thay thế `var` → `const`
- Thay thế `console.log` → `console.info`
- Thêm error handling code
- Thêm comments

Trong thực tế, bạn sẽ thay thế function này bằng:
- Gọi AI API (OpenAI, Claude, v.v.)
- Hoặc browser automation để tương tác với chatbot web

## Customize

### Thay đổi màu sắc

Edit `src/decorations.ts`:

```typescript
backgroundColor: 'rgba(0, 255, 0, 0.15)', // Màu nền xanh
before: {
  contentText: '+ ',
  color: '#00ff00', // Màu chữ
}
```

### Thay đổi AI suggestion logic

Edit function `simulateAISuggestion()` trong `src/extension.ts`

### Thêm keyboard shortcuts

Edit `package.json` > `contributes.keybindings`

## Roadmap

- [ ] Tích hợp với AI API thực
- [ ] Browser automation cho chatbot web
- [ ] Partial accept (chọn một phần của suggestion)
- [ ] Diff history
- [ ] Multiple suggestions
- [ ] Custom keybindings cho accept/reject

## Troubleshooting

### Extension không load

```bash
# Xóa node_modules và reinstall
rm -rf node_modules
npm install
npm run compile
```

### Decorations không hiển thị

- Kiểm tra console trong Extension Development Host
- Đảm bảo file có content trước khi trigger diff

### CodeLens không xuất hiện

- Đảm bảo đã trigger diff với `Ctrl+Shift+D`
- Kiểm tra CodeLens có enabled trong VS Code settings

## License

MIT
