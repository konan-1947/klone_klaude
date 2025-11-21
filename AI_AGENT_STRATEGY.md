# Chiến Lược AI Agent cho IDE

## Tổng Quan

Document này mô tả chiến lược thực thi AI Agent trong IDE, tập trung vào concepts và workflow, không bao gồm code implementation.

---

## Workflow Tổng Thể

```
User Request
    ↓
Complexity Assessment (Heuristic hoặc LLM)
    ↓
Simple Path (1 LLM Call) ←→ Complex Path (Multiple LLM Calls)
    ↓
Show Inline Diff
```

---

## I. COMPLEXITY ASSESSMENT

### Mục Đích
Quyết định xem task cần xử lý đơn giản (1 LLM call) hay phức tạp (multiple LLM calls với planning).

### 1. Heuristic-Based Classification

**Simple Tasks** - Các đặc điểm:
- Chỉ ảnh hưởng 1 file
- Dưới 100 dòng code
- Không cần phân tích dependencies
- Không cần verify phức tạp

**Ví dụ Simple**: Rename variable, add comments, format code, fix typo, add type annotations

**Complex Tasks** - Các đặc điểm:
- Ảnh hưởng nhiều files
- Trên 100 dòng code
- Cần phân tích dependencies
- Thay đổi architecture
- Có security/performance implications
- Cần testing/verification

**Ví dụ Complex**: Refactor across files, architecture changes, add features, debug complex issues, optimization, security fixes

**Cách hoạt động**:
- Check keywords trong request
- Check code size và file count
- Confidence: 80%
- Không cần LLM call

### 2. LLM-Based Classification

**Khi nào dùng**: Heuristic không chắc chắn (confidence < 80%)

**Input**: User request + code context + file info

**Output**: 
- Complexity level (simple/complex)
- Reason
- Estimated steps
- Confidence score
- Suggested approach

### 3. Hybrid Approach (Khuyến Nghị)

**Workflow**:
1. Quick heuristic check trước
2. Nếu confidence > 80% → Dùng kết quả heuristic
3. Nếu confidence < 80% → Gọi LLM để classify

**Lợi ích**:
- Tiết kiệm 80% LLM calls
- Vẫn accurate cho edge cases
- Fast decision making
- Cost-effective

---

## II. SIMPLE PATH (Direct Execution)

### Workflow

```
User Request (classified as SIMPLE)
    ↓
Single LLM Call
    ↓
Parse Response
    ↓
Show Inline Diff
```

### Characteristics

- **LLM Calls**: 1
- **Time**: 2-5 seconds
- **Cost**: $0.01 - $0.03
- **User Experience**: Fast, immediate results
- **Use Cases**: 70-80% of requests

### Process

1. **Input to LLM**: System prompt + user request + code context + file info
2. **Output from LLM**: Generated/refactored code hoặc explanation text
3. **Parse**: Extract code, validate syntax
4. **Display**: Show inline diff với green (additions) và red (deletions)

---

## III. COMPLEX PATH (Planning + Execution)

### Workflow

```
User Request (classified as COMPLEX)
    ↓
Planning (LLM Call #1)
    ↓
Show Plan to User (Optional)
    ↓
Execute Each Step (LLM Calls #2-N)
    ↓
Update Plan if Needed
    ↓
Final Result
```
