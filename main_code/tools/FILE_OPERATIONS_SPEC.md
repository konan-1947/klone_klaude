# File Operations Tools - Chi tiết Specification

Tài liệu này mô tả chi tiết 5 công cụ thao tác với files của Cline, bao gồm chức năng, parameters, và cách hoạt động.

---

## Tổng quan

File Operations bao gồm 5 tools chính để thao tác với file system:

| Tool | ID | Chức năng chính |
|------|-----|----------------|
| `read_file` | `FILE_READ` | Đọc nội dung file |
| `write_to_file` | `FILE_NEW` | Tạo file mới hoặc ghi đè file |
| `replace_in_file` | `FILE_EDIT` | Sửa nội dung file (search & replace) |
| `list_files` | `LIST_FILES` | Liệt kê files và folders |
| `search_files` | `SEARCH` | Tìm kiếm nội dung trong files |

---

## 1. read_file

### Mô tả
Đọc nội dung của một file tại đường dẫn chỉ định. Sử dụng khi cần kiểm tra nội dung của file, phân tích code, review text files, hoặc trích xuất thông tin từ configuration files.

### Tính năng đặc biệt
- **Hỗ trợ PDF và DOCX**: Tự động extract raw text từ PDF và DOCX files
- **Binary files**: Trả về raw content dưới dạng string (có thể không phù hợp với một số binary files)
- **Image support**: Nếu model hỗ trợ, có thể đọc và hiển thị images

### Parameters

| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `path` | string | ✅ Yes | Đường dẫn tương đối đến file cần đọc (relative to CWD) |

### Example Usage

```json
{
  "name": "read_file",
  "params": {
    "path": "src/core/browser/AIStudioBrowser.ts"
  }
}
```

### Response Format
Trả về nội dung file dạng text string.

### Edge Cases & Error Handling
- ❌ File không tồn tại → Error
- ❌ Không có quyền đọc → Error
- ❌ File bị chặn bởi `.clineignore` → Error
- ⚠️ Binary file → Trả về raw content (có thể không readable)

### Important Notes
- ⚠️ **KHÔNG** dùng tool này để list nội dung directory
- ⚠️ Chỉ dùng trên files, không phải folders
- ✅ Luôn dùng relative path từ working directory

---

## 2. write_to_file

### Mô tả
Tạo file mới hoặc ghi đè hoàn toàn nội dung file hiện có. Tool này được dùng khi cần tạo file mới hoặc thay thế toàn bộ nội dung file.

### Tính năng đặc biệt
- **Auto-create directories**: Tự động tạo parent directories nếu chưa tồn tại
- **Diff view**: Hiển thị diff view trong VS Code khi edit file
- **Real-time streaming**: Content được stream vào editor theo thời gian thực
- **User edit detection**: Phát hiện nếu user chỉnh sửa trong lúc AI đang edit
- **Auto-formatting**: Tự động format code sau khi save (nếu có formatter)
- **Diagnostics tracking**: Theo dõi errors/warnings sau khi edit

### Parameters

| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `path` | string | ✅ Yes | Đường dẫn tương đối đến file cần tạo/ghi |
| `content` | string | ✅ Yes | Nội dung đầy đủ của file |

### Example Usage

**Tạo file mới:**
```json
{
  "name": "write_to_file",
  "params": {
    "path": "src/utils/logger.ts",
    "content": "export const logger = {\n  info: (msg: string) => console.log(msg)\n};"
  }
}
```

**Ghi đè file:**
```json
{
  "name": "write_to_file",
  "params": {
    "path": "package.json",
    "content": "{\n  \"name\": \"my-app\",\n  \"version\": \"1.0.0\"\n}"
  }
}
```

### Response Format
```
File created/updated successfully at: <path>
<optional: new problems/warnings detected>
<optional: user made additional edits>
```

### Workflow
1. **Validation**: Kiểm tra path hợp lệ, không bị `.clineignore` block
2. **Pre-processing**: Xử lý markdown code blocks, escape characters
3. **Diff View**: Mở diff view trong VS Code
4. **Approval**: Chờ user approve (nếu không auto-approve)
5. **Save**: Lưu file và apply changes
6. **Post-processing**: Chạy formatter, check diagnostics
7. **User edit detection**: Nếu user sửa thêm, report lại cho AI

### Edge Cases & Error Handling
- ✅ File chưa tồn tại → Tạo mới (kể cả parent folders)
- ✅ File đã tồn tại → Ghi đè (sau khi approve)
- ❌ Path bị `.clineignore` block → Error
- ⚠️ Content có markdown code blocks (```python) → Auto-remove
- ⚠️ Content có HTML entities (&amp;) → Auto-fix cho một số models

### Important Notes
- ⚠️ Tool này **GHI ĐÈ** toàn bộ nội dung file
- ✅ Nếu chỉ muốn sửa một phần → Dùng `replace_in_file`
- ✅ Tự động xử lý markdown artifacts từ weak models
- ✅ Hỗ trợ streaming content (hiển thị từng phần trong editor)

---

## 3. replace_in_file (Edit File)

### Mô tả
Sửa đổi nội dung file bằng cách search & replace. Đây là tool ưu tiên khi cần chỉnh sửa một phần nhỏ của file mà không cần rewrite toàn bộ.

### Tính năng đặc biệt
- **Search & Replace**: Tìm text cũ và thay bằng text mới
- **Diff-based editing**: Sử dụng diff format để specify changes
- **Intelligent matching**: Tìm kiếm thông minh, bỏ qua whitespace differences
- **Multi-block edits**: Có thể edit nhiều blocks trong một lần
- **Error recovery**: Detailed error messages khi search text không match

### Parameters

| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `path` | string | ✅ Yes | Đường dẫn tương đối đến file cần edit |
| `diff` | string | ✅ Yes | Diff content (search/replace blocks) |

### Diff Format

Cline sử dụng format đặc biệt cho diff:

```
<<<<<<< SEARCH
old line 1
old line 2
=======
new line 1
new line 2
>>>>>>> REPLACE
```

**Ví dụ cụ thể:**

```
export const API_URL = 'https://api.production.com';
```

### Example Usage

**Sửa một dòng code:**
```json
{
  "name": "replace_in_file",
  "params": {
    "path": "src/config.ts",
    "diff": "<<<<<<< SEARCH\nconst PORT = 3000;\n=======\nconst PORT = 8080;\n>>>>>>> REPLACE"
  }
}
```

**Sửa multiple blocks:**
```json
{
  "name": "replace_in_file",
  "params": {
    "path": "src/app.ts",
    "diff": "<<<<<<< SEARCH\nimport express from 'express';\n=======\nimport express from 'express';\nimport cors from 'cors';\n>>>>>>> REPLACE\n\n<<<<<<< SEARCH\napp.listen(3000);\n=======\napp.use(cors());\napp.listen(3000);\n>>>>>>> REPLACE"
  }
}
```

### Response Format
```
File edited successfully at: <path>
Changes applied:
- <number> search/replace blocks processed
<optional: new problems detected>
<optional: user made additional edits>
```

### Workflow
1. **File read**: Đọc nội dung file hiện tại
2. **Diff parsing**: Parse diff blocks (SEARCH/REPLACE pairs)
3. **Search matching**: Tìm SEARCH text trong file
4. **Construct new content**: Thay SEARCH bằng REPLACE
5. **Diff view**: Hiển thị changes trong VS Code
6. **Approval & Save**: Chờ approve và save

### Edge Cases & Error Handling
- ❌ SEARCH text không tồn tại → Error với message chi tiết
- ❌ SEARCH text match multiple locations → Error (ambiguous)
- ❌ Malformed diff format → Error
- ✅ Whitespace differences → Intelligent matching
- ⚠️ HTML entities (&amp;) → Auto-fix cho deepseek models

### Search Matching Rules
1. **Exact match ưu tiên**: Tìm exact match trước
2. **Whitespace flexible**: Bỏ qua trailing/leading whitespace
3. **Unique match required**: SEARCH phải unique trong file
4. **Context-aware**: Có thể include surrounding lines để uniqueness

### Important Notes
- ✅ **ƯU TIÊN** tool này hơn `write_to_file` khi chỉ sửa một phần
- ✅ SEARCH text phải **CHÍNH XÁC** match với code hiện tại
- ⚠️ Nếu file đã thay đổi, SEARCH có thể fail
- ✅ Có thể gộp nhiều edits trong một diff block

---

## 4. list_files

### Mô tả
Liệt kê tất cả files và directories trong một thư mục. Hỗ trợ cả list top-level và recursive.

### Tính năng đặc biệt
- **Recursive listing**: Có thể list toàn bộ tree structure
- **Size information**: Hiển thị size của files
- **Type indication**: Phân biệt file vs directory
- **.clineignore support**: Tự động exclude files/folders bị ignore
- **Result limit**: Giới hạn 200 items để tránh quá tải

### Parameters

| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `path` | string | ✅ Yes | Đường dẫn đến directory cần list |
| `recursive` | boolean | ❌ No | `true` = list recursive, `false` = top-level only |

### Example Usage

**List top-level:**
```json
{
  "name": "list_files",
  "params": {
    "path": "src",
    "recursive": false
  }
}
```

**List recursive:**
```json
{
  "name": "list_files",
  "params": {
    "path": "src",
    "recursive": true
  }
}
```

### Response Format

**Top-level:**
```
Files in src/:
- core/ (directory)
- utils/ (directory)
- extension.ts (file, 2.1 KB)
- types/ (directory)
```

**Recursive:**
```
Files in src/ (recursive):
src/
  core/
    browser/
      AIStudioBrowser.ts (3.1 KB)
      initializeBrowser.ts (1.2 KB)
    cookie/
      CookieManager.ts (2.5 KB)
  utils/
    logger.ts (0.5 KB)
  extension.ts (2.1 KB)

Total: 15 files, 5 directories
```

### Workflow
1. **Path resolution**: Resolve absolute path
2. **Permission check**: Check `.clineignore`
3. **Directory scan**: Scan directory (recursive or not)
4. **Filter**: Apply `.clineignore` rules
5. **Format**: Format output với size, type

### Edge Cases & Error Handling
- ❌ Path không tồn tại → Error
- ❌ Path là file (không phải folder) → Error
- ❌ Không có quyền đọc → Error
- ⚠️ Quá 200 items → Truncate với warning
- ✅ Empty directory → "No files found"

### Important Notes
- ⚠️ **KHÔNG** dùng tool này để confirm file đã được tạo
- ✅ Dùng để explore project structure
- ✅ Recursive mode tốn thời gian hơn
- ✅ Tự động exclude node_modules, .git (qua .clineignore)

---

## 5. search_files

### Mô tả
Tìm kiếm nội dung trong files sử dụng regex pattern. Tool mạnh mẽ để find code, text, hoặc patterns trong codebase.

### Tính năng đặc biệt
- **Regex search**: Hỗ trợ full regex patterns
- **File pattern filtering**: Filter theo file types (*.ts, *.js...)
- **Multi-workspace search**: Search across multiple workspaces
- **Context lines**: Hiển thị surrounding lines của match
- **Performance**: Sử dụng ripgrep (rất nhanh)
- **.clineignore support**: Tự động skip ignored files

### Parameters

| Parameter | Type | Required | Mô tả |
|-----------|------|----------|-------|
| `path` | string | ✅ Yes | Directory để search |
| `regex` | string | ✅ Yes | Regex pattern để tìm |
| `file_pattern` | string | ❌ No | File pattern filter (e.g., "*.ts") |

### Example Usage

**Basic search:**
```json
{
  "name": "search_files",
  "params": {
    "path": "src",
    "regex": "AIStudioBrowser"
  }
}
```

**Search với file filter:**
```json
{
  "name": "search_files",
  "params": {
    "path": "src",
    "regex": "export class",
    "file_pattern": "*.ts"
  }
}
```

**Search regex pattern:**
```json
{
  "name": "search_files",
  "params": {
    "path": "src",
    "regex": "async function \\w+",
    "file_pattern": "*.ts"
  }
}
```

### Response Format

```
Found 3 results in src/:

src/core/browser/AIStudioBrowser.ts:
  10: export class AIStudioBrowser {
  28:   async initialize(): Promise<void> {
  56:   async sendPrompt(prompt: string): Promise<string> {

src/providers/chat/ChatViewProvider.ts:
  17:   private aiStudioBrowser: AIStudioBrowser | null = null;
```

### Workflow
1. **Parse parameters**: Extract path, regex, file_pattern
2. **Workspace resolution**: Resolve search paths (support multi-workspace)
3. **Execute ripgrep**: Run parallel searches
4. **Format results**: Format với file paths, line numbers, context
5. **Combine**: Aggregate results from multiple workspaces

### Edge Cases & Error Handling
- ❌ Invalid regex → Error với syntax message
- ❌ Path không tồn tại → Error
- ✅ No matches → "Found 0 results"
- ⚠️ Too many results → Truncate (configurable limit)
- ✅ Special regex chars → Need proper escaping

### Regex Tips
- **Literal search**: Sử dụng plain text (không special chars)
- **Case-insensitive**: Thêm `(?i)` prefix
- **Word boundary**: Dùng `\b` để match whole words
- **Escape special chars**: `.` → `\.`, `*` → `\*`

### Important Notes
- ✅ Rất nhanh (sử dụng ripgrep)
- ✅ Hỗ trợ complex regex patterns
- ⚠️ Tránh regex quá vague (match hàng nghìn results)
- ✅ Dùng `file_pattern` để narrow down search
- ✅ Perfect cho code exploration và refactoring

---

## So sánh & Khi nào dùng tool nào

### read_file vs list_files
- **read_file**: Đọc **NỘI DUNG** của 1 file
- **list_files**: List **TÊN** của nhiều files trong folder

### write_to_file vs replace_in_file
- **write_to_file**: Tạo mới hoặc **GHI ĐÈ TOÀN BỘ** file
- **replace_in_file**: **SỬA MỘT PHẦN** của file (ưu tiên hơn)

### list_files vs search_files
- **list_files**: Tìm files theo **TÊN/STRUCTURE**
- **search_files**: Tìm files theo **NỘI DUNG**

---

## Best Practices

### 1. Ưu tiên replace_in_file hơn write_to_file
```
❌ BAD: Dùng write_to_file để sửa 1 dòng
✅ GOOD: Dùng replace_in_file với SEARCH/REPLACE
```

### 2. Kiểm tra file trước khi edit
```
1. read_file → xem nội dung hiện tại
2. replace_in_file → edit chính xác
```

### 3. Sử dụng search_files để explore
```
1. search_files → tìm nơi define
2. read_file → đọc chi tiết
3. replace_in_file → edit
```

### 4. List files để hiểu structure
```
1. list_files (path=".", recursive=false) → overview
2. list_files (path="src", recursive=true) → details
```

### 5. Regex search cẩn thận
```
❌ BAD: regex=".*" → match cả triệu dòng
✅ GOOD: regex="async function \w+", file_pattern="*.ts"
```

---

## Common Workflows

### Workflow 1: Tạo file mới
```
1. list_files (kiểm tra structure)
2. write_to_file (tạo file mới)
```

### Workflow 2: Sửa file hiện có
```
1. read_file (đọc nội dung hiện tại)
2. replace_in_file (sửa specific parts)
```

### Workflow 3: Refactoring
```
1. search_files (tìm tất cả occurrences)
2. read_file (verify từng file)
3. replace_in_file (update từng file)
```

### Workflow 4: Explore codebase
```
1. list_files (recursive) → structure
2. search_files → find specific code
3. read_file → understand details
```

---

## Error Messages & Troubleshooting

### "File not found"
- ✅ Check path spelling
- ✅ Ensure path is relative to CWD
- ✅ Verify file exists với list_files

### "Search text does not match"
- ✅ Đọc file với read_file trước
- ✅ Copy EXACT text từ file
- ✅ Include enough context để unique

### "Permission denied"
- ✅ Check file permissions
- ✅ Check .clineignore rules

### "Too many results"
- ✅ Narrow search với file_pattern
- ✅ Make regex more specific
- ✅ Search trong smaller directory

---

## Technical Implementation Notes

### Dependencies
- **ripgrep**: For fast file searching
- **VS Code API**: For diff view, editor operations
- **File system**: Node.js fs operations

### Performance Considerations
- **list_files recursive**: O(n) where n = total files
- **search_files**: Very fast (ripgrep optimized)
- **read_file**: O(1) single file read
- **write_to_file**: O(1) single file write
- **replace_in_file**: O(n) where n = file size

### Safety Features
1. **.clineignore**: Prevent access to sensitive files
2. **User approval**: Manual approval for critical operations
3. **Diff view**: Review changes before applying
4. **Backup**: VS Code undo history
5. **Validation**: Path and parameter validation

---

## Kết luận

5 File Operations tools tạo nên foundation mạnh mẽ cho AI coding assistant:

1. ✅ **read_file**: Understand existing code
2. ✅ **write_to_file**: Create new files
3. ✅ **replace_in_file**: Modify existing code (primary edit tool)
4. ✅ **list_files**: Explore project structure
5. ✅ **search_files**: Find code across codebase

Kết hợp thông minh 5 tools này cho phép AI thực hiện hầu hết các file operations cần thiết trong software development.
