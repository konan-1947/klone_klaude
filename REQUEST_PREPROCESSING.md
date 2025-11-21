# Giai Đoạn Tiền Xử Lý Request

## Tổng Quan

Mỗi user request trải qua 3 bước tiền xử lý trước khi execution:
1. Complexity Assessment
2. Plan Generation
3. Plan Validation

---

## Workflow Tổng Thể

```
User Request
    ↓
[1. Complexity Assessment]
    ↓
[2. Plan Generation]
    ↓
[3. Plan Validation]
    ↓
Execute Plan
```

---

## 1. COMPLEXITY ASSESSMENT

### Mục Đích
Quyết định cách xử lý request: Simple path hay Complex path

### Input
- User request text
- Selected code
- File count
- Code size

### Process

**Heuristic Check** (không cần LLM):
- Check keywords (rename, format, fix typo → simple)
- Check code size (< 100 lines → simple)
- Check file count (1 file → simple)
- Confidence: 80%

**Nếu confidence < 80%** → LLM Classification:
- Send request + context to LLM
- LLM classify: simple hoặc complex
- Confidence: 95%+

### Output
```
{
  complexity: "simple" | "complex",
  confidence: 0.8-1.0,
  reason: "Single function, < 50 lines"
}
```

### Decision
- Simple → Simple Path (1 LLM call, no planning)
- Complex → Complex Path (planning + execution)

---

## 2. PLAN GENERATION

### Chỉ Chạy Nếu: Complexity = Complex

### Approach A: Template-Based (MVP)

**Process**:
1. Classify task type (refactor, generate, debug, etc.)
2. Select matching template
3. Fill template với context

**Templates**:
- Simple Refactoring: Analyze → Generate → Verify
- Complex Refactoring: Analyze → Find Dependencies → Generate → Verify
- Test-Driven: Generate → Test → Fix → Test (retry)
- Code Generation: Understand Requirements → Generate → Validate

**Output**: List of steps

---

### Approach B: LLM-Generated (Future)

**Process**:
1. Build planning prompt
2. Send to LLM: "Create execution plan"
3. LLM returns JSON với steps array
4. Parse JSON

**LLM Input**:
- User request
- Code context
- Available actions (llm, tool)

**LLM Output**:
```
{
  "steps": [
    {
      "stepName": "Analyze Code",
      "actionType": "llm",
      "config": { "prompt": "..." }
    },
    {
      "stepName": "Run Tests",
      "actionType": "tool",
      "config": { "toolName": "run_tests" }
    }
  ]
}
```

---

## 3. PLAN VALIDATION

### Mục Đích
Đảm bảo plan hợp lệ trước khi execute

### Validation Rules

**Structure**:
- Steps count: 1-10 (không quá nhiều)
- Mỗi step có đủ fields (stepName, actionType, config)

**Content**:
- actionType valid: "llm" hoặc "tool"
- config không empty
- Prompts rõ ràng (cho llm steps)
- Tool names valid (cho tool steps)

**Logic**:
- Steps có thứ tự hợp lý
- Không có circular dependencies
- First step không depend on output

### Nếu Invalid

**Option 1**: Retry generation (nếu LLM-generated)

**Option 2**: Fallback to template

**Option 3**: Use generic fallback plan:
```
1. Analyze request
2. Execute task
3. Verify result
```

---

## 4. OUTPUT

### Simple Path
```
{
  complexity: "simple",
  plan: null,  // Không cần plan
  action: "direct_execution"
}
```

### Complex Path
```
{
  complexity: "complex",
  plan: {
    steps: [
      { stepName: "...", actionType: "llm", config: {...} },
      { stepName: "...", actionType: "tool", config: {...} },
      ...
    ],
    estimatedTime: "45s",
    estimatedCost: "$0.15"
  },
  action: "execute_plan"
}
```

---

## VÍ DỤ CỤ THỂ

### Example 1: Simple Request

**Input**:
```
User: "Rename variable 'data' to 'userData'"
Code: 30 lines, 1 file
```

**Step 1 - Complexity Assessment**:
```
Heuristic check:
  - Keyword "rename" → simple
  - 30 lines → simple
  - 1 file → simple
  
Result: complexity = "simple", confidence = 0.95
```

**Step 2 - Plan Generation**:
```
Skip (simple path không cần plan)
```

**Step 3 - Validation**:
```
Skip
```

**Output**:
```
{
  complexity: "simple",
  action: "direct_execution"
}
```

---

### Example 2: Complex Request

**Input**:
```
User: "Refactor authentication system"
Code: Multiple files
```

**Step 1 - Complexity Assessment**:
```
Heuristic check:
  - Keyword "system" → complex
  - Multiple files → complex
  
Result: complexity = "complex", confidence = 0.90
```

**Step 2 - Plan Generation (Template)**:
```
Task type: Refactoring
Template: Complex Refactoring

Generated plan:
1. Analyze current authentication
2. Find all auth-related files
3. Generate refactored code
4. Verify changes
```

**Step 3 - Validation**:
```
Check:
  - Steps count: 4 ✓
  - All steps have required fields ✓
  - actionTypes valid ✓
  - Logic reasonable ✓
  
Result: Valid
```

**Output**:
```
{
  complexity: "complex",
  plan: {
    steps: [
      { stepName: "Analyze current authentication", ... },
      { stepName: "Find all auth-related files", ... },
      { stepName: "Generate refactored code", ... },
      { stepName: "Verify changes", ... }
    ],
    estimatedTime: "45s"
  },
  action: "execute_plan"
}
```

---

## METRICS

### Timing

**Simple Path**:
- Complexity assessment: < 0.1s (heuristic)
- Total preprocessing: < 0.1s

**Complex Path (Template)**:
- Complexity assessment: < 0.1s
- Plan generation: < 0.5s
- Validation: < 0.1s
- Total preprocessing: < 1s

**Complex Path (LLM Planning)**:
- Complexity assessment: 2s (LLM)
- Plan generation: 3s (LLM)
- Validation: < 0.1s
- Total preprocessing: ~5s

---

## DECISION TREE

```
User Request
    ↓
Heuristic Check
    ├─ Confidence > 80%
    │   ├─ Simple → Direct Execution
    │   └─ Complex → Template Planning → Validate → Execute
    │
    └─ Confidence < 80%
        └─ LLM Classification
            ├─ Simple → Direct Execution
            └─ Complex → Template Planning → Validate → Execute
```

---

## KHUYẾN NGHỊ

### Phase 1 (MVP)
- Heuristic complexity check
- Template-based planning
- Basic validation

### Phase 2
- Add LLM classification (cho uncertain cases)
- More templates
- Better validation

### Phase 3
- LLM-generated planning
- Adaptive templates
- Advanced validation

---

## SUMMARY

**Tiền xử lý gồm 3 bước**:
1. Complexity Assessment (heuristic hoặc LLM)
2. Plan Generation (template hoặc LLM)
3. Plan Validation (rules-based)

**Output**: Complexity level + Execution plan (nếu complex)

**Time**: < 1s (template) hoặc ~5s (LLM)
