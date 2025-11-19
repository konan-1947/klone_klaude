# Hướng Dẫn Tạo VS Code Extension với Inline Diff

## Tổng Quan

Extension này sẽ hiển thị AI suggestions dưới dạng inline diff với:
- Dòng **xanh** (+): Thêm mới
- Dòng **đỏ** (-): Xóa bỏ (strikethrough)
- Có thể **sửa trực tiếp** trong file
- **Accept/Reject** từng dòng hoặc tất cả

## Các Bước Thực Hiện

### Bước 1: Setup Extension Project

```bash
# Cài đặt Yeoman và VS Code Extension Generator
npm install -g yo generator-code

# Tạo extension mới
yo code

# Chọn:
# - New Extension (TypeScript)
# - Extension name: inline-diff-demo
# - Identifier: inline-diff-demo
# - Description: Inline diff demo for AI suggestions
# - Initialize git: Yes
# - Package manager: npm
```

### Bước 2: Cài Đặt Dependencies

```bash
cd inline-diff-demo
npm install diff
npm install @types/diff --save-dev
```

### Bước 3: Cấu Trúc Project

```
inline-diff-demo/
├── src/
│   ├── extension.ts          # Entry point
│   ├── diffManager.ts        # Quản lý diff logic
│   ├── decorations.ts        # Decoration styles
│   ├── codeLensProvider.ts   # Accept/Reject buttons
│   └── diffComputer.ts       # Compute line diff
├── package.json              # Extension manifest
└── tsconfig.json
```

### Bước 4: Implement Core Features

#### 4.1. Decorations (decorations.ts)

Tạo các decoration types cho dòng thêm/xóa/sửa.

#### 4.2. Diff Computer (diffComputer.ts)

Sử dụng thư viện `diff` để tính toán sự khác biệt giữa original và modified.

#### 4.3. Diff Manager (diffManager.ts)

Quản lý việc apply decorations và track diff state.

#### 4.4. CodeLens Provider (codeLensProvider.ts)

Hiển thị buttons Accept/Reject cho từng dòng và toàn bộ file.

#### 4.5. Extension Entry Point (extension.ts)

Đăng ký commands và activate extension.

### Bước 5: Đăng Ký Commands trong package.json

```json
{
  "contributes": {
    "commands": [
      {
        "command": "inline-diff.showDiff",
        "title": "Show AI Inline Diff"
      },
      {
        "command": "inline-diff.acceptAll",
        "title": "Accept All Changes"
      },
      {
        "command": "inline-diff.rejectAll",
        "title": "Reject All Changes"
      }
    ],
    "keybindings": [
      {
        "command": "inline-diff.showDiff",
        "key": "ctrl+shift+d",
        "mac": "cmd+shift+d"
      }
    ]
  }
}
```

### Bước 6: Test Extension

```bash
# Trong VS Code, nhấn F5 để mở Extension Development Host
# Hoặc chạy:
npm run compile
code --extensionDevelopmentPath=.
```

### Bước 7: Sử Dụng

1. Mở một file JavaScript/TypeScript
2. Nhấn `Ctrl+Shift+D` (hoặc `Cmd+Shift+D` trên Mac)
3. Extension sẽ simulate AI suggestion và hiển thị inline diff
4. Dòng xanh (+): Thêm mới
5. Dòng đỏ (-): Xóa (strikethrough)
6. Click CodeLens để Accept/Reject
7. Có thể sửa trực tiếp các dòng

## Workflow Chi Tiết

### 1. User Trigger Diff

```
User nhấn Ctrl+Shift+D
    ↓
Extension lấy content hiện tại
    ↓
Gọi AI (hoặc mock AI response)
    ↓
Nhận suggested content
```

### 2. Compute Diff

```
Original content + AI suggested content
    ↓
Sử dụng diff library
    ↓
Tạo danh sách: additions, deletions, modifications
```

### 3. Apply Inline Diff

```
Insert các dòng mới vào editor
    ↓
Apply decorations (xanh/đỏ)
    ↓
Show CodeLens (Accept/Reject buttons)
    ↓
User có thể sửa trực tiếp
```

### 4. Accept/Reject

```
User click Accept All
    ↓
Xóa tất cả dòng đỏ (deletions)
    ↓
Clear decorations
    ↓
File chỉ còn dòng mới (xanh) và dòng không đổi
```

## API Chính Sử Dụng

### VS Code Extension API

1. **TextEditor API**
   - `editor.edit()`: Chỉnh sửa document
   - `editor.setDecorations()`: Apply decorations

2. **Decorations API**
   - `createTextEditorDecorationType()`: Tạo decoration style
   - `backgroundColor`, `textDecoration`: Styling

3. **CodeLens API**
   - `CodeLensProvider`: Hiển thị inline buttons
   - `provideCodeLenses()`: Tạo CodeLens items

4. **Commands API**
   - `registerCommand()`: Đăng ký commands
   - `executeCommand()`: Thực thi commands

### Diff Library

```typescript
import * as diff from 'diff';

const changes = diff.diffLines(original, modified);
// changes chứa: added, removed, value
```

## Tính Năng Nâng Cao (Optional)

### 1. Partial Accept

Accept chỉ một phần của suggestion thay vì toàn bộ.

### 2. Undo/Redo

Tích hợp với VS Code undo stack.

### 3. Multiple Suggestions

Hiển thị nhiều AI suggestions và cho user chọn.

### 4. Diff History

Lưu lại lịch sử các diff đã apply.

### 5. Custom Keybindings

- `Tab`: Accept current line
- `Esc`: Reject current line
- `Ctrl+Enter`: Accept all

## Troubleshooting

### Decorations không hiển thị

- Kiểm tra range có hợp lệ không
- Kiểm tra decoration type đã được tạo chưa

### CodeLens không xuất hiện

- Đảm bảo đã register CodeLensProvider
- Kiểm tra `provideCodeLenses()` return đúng array

### Performance issues

- Limit số lượng decorations
- Debounce khi user typing
- Cache diff results

## Best Practices

1. **Validation**: Validate input trước khi compute diff
2. **Error Handling**: Wrap tất cả operations trong try-catch
3. **User Feedback**: Show progress khi compute diff lớn
4. **Cleanup**: Clear decorations khi không dùng
5. **Testing**: Viết unit tests cho diff logic

## Tài Liệu Tham Khảo

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Decorations API](https://code.visualstudio.com/api/references/vscode-api#TextEditorDecorationType)
- [CodeLens API](https://code.visualstudio.com/api/references/vscode-api#CodeLensProvider)
- [diff library](https://github.com/kpdecker/jsdiff)

## Kết Luận

Với approach này, bạn có thể tạo một extension có khả năng hiển thị inline diff tương tự Cursor, với đầy đủ tính năng:
- Visual diff (xanh/đỏ)
- Editable inline
- Accept/Reject granular
- Performance tốt

Extension này có thể là nền tảng để xây dựng IDE tương tác với chatbot như ý tưởng ban đầu của bạn.
