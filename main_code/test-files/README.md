# Test Files

File này chứa các file mock để test Read File Tool

## Danh sách files:

1. **simple.txt** - File text đơn giản
2. **sample-code.ts** - File TypeScript code
3. **mock-package.json** - Mock package.json
4. **empty.txt** - File rỗng
5. **secret.txt** - File sẽ bị block bởi .aiignore
6. **nested/deep-file.txt** - File trong subfolder
7. **large.txt** - File lớn (>1MB) để test warning

## Test cases:

✅ Đọc file thành công: `test-files/simple.txt`
✅ Đọc code file: `test-files/sample-code.ts`
✅ Đọc JSON: `test-files/mock-package.json`
✅ Đọc file rỗng: `test-files/empty.txt`
✅ Đọc nested file: `test-files/nested/deep-file.txt`
❌ File bị block: `test-files/secret.txt`
❌ File không tồn tại: `test-files/notfound.txt`
⚠️ File lớn: `test-files/large.txt`
