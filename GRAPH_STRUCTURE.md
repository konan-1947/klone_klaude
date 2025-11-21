# Cấu Trúc Graph cho AI Agent Workflow

## Tổng Quan

Document này mô tả cấu trúc Node và Graph để xây dựng AI Agent workflow theo graph-based approach.

---

## I. NODE STRUCTURE

### Node Definition

Node là đơn vị thực thi cơ bản trong workflow, đại diện cho một bước xử lý.

### Core Attributes

**Identity**:
- `nodeId`: Unique identifier
- `nodeName`: Human-readable name
- `nodeType`: Loại node (llm, tool, decision, merge)

**Input/Output**:
- `input`: Dữ liệu đầu vào
- `output`: Kết quả đầu ra
- `inputSchema`: Định nghĩa cấu trúc input
- `outputSchema`: Định nghĩa cấu trúc output

**Execution**:
- `status`: pending | running | completed | failed | skipped
- `startTime`: Thời điểm bắt đầu
- `endTime`: Thời điểm kết thúc
- `duration`: Thời gian thực thi
- `retryCount`: Số lần retry

**Context**:
- `context`: Shared context across nodes
- `localState`: State riêng của node
- `metadata`: Thông tin bổ sung

**Error Handling**:
- `error`: Error object nếu failed
- `maxRetries`: Số lần retry tối đa
- `retryStrategy`: Chiến lược retry
- `fallbackNode`: Node dự phòng nếu fail

**Relationships**:
- `dependencies`: Danh sách nodes phải complete trước
- `dependents`: Danh sách nodes phụ thuộc vào node này

---

## II. NODE TYPES

### 1. LLM Node

**Purpose**: Gọi LLM để reasoning/generation

**Specific Attributes**:
- `prompt`: Template prompt
- `systemPrompt`: System instruction
- `temperature`: Creativity level
- `maxTokens`: Giới hạn output
- `model`: Model name

**Input**:
- User request
- Code context
- Conversation history
- Task description

**Output**:
- Generated text/code
- Reasoning explanation
- Confidence score

**Example Use Cases**:
- Planning: Tạo execution plan
- Code Generation: Generate code
- Analysis: Phân tích code
- Decision Making: Quyết định next step

---

### 2. Tool Node

**Purpose**: Thực thi tool/function cụ thể

**Specific Attributes**:
- `toolName`: Tên tool
- `toolParams`: Parameters cho tool
- `toolType`: read_file | write_file | run_command | search

**Input**:
- Tool parameters
- Context data

**Output**:
- Tool execution result
- Success/failure status
- Error message nếu có

**Example Use Cases**:
- Read File: Đọc file code
- Write File: Ghi code mới
- Run Tests: Chạy unit tests
- Search: Tìm kiếm trong codebase

---

### 3. Decision Node

**Purpose**: Quyết định routing dựa trên conditions

**Specific Attributes**:
- `conditions`: Danh sách điều kiện
- `defaultRoute`: Route mặc định
- `evaluationLogic`: Logic đánh giá

**Input**:
- Data cần evaluate
- Conditions

**Output**:
- Selected route
- Evaluation result

**Example Use Cases**:
- Complexity Check: Simple vs Complex path
- Error Check: Retry vs Abort
- Test Result: Pass vs Fail
- Condition Check: Continue vs Update Plan

---

### 4. Merge Node

**Purpose**: Kết hợp outputs từ nhiều nodes

**Specific Attributes**:
- `mergeStrategy`: concat | select | combine
- `waitForAll`: Có đợi tất cả inputs không

**Input**:
- Multiple outputs từ parallel nodes

**Output**:
- Merged result

**Example Use Cases**:
- Combine Analysis: Kết hợp phân tích từ nhiều files
- Aggregate Results: Tổng hợp test results
- Merge Code: Kết hợp code từ nhiều sources

---

### 5. Loop Node

**Purpose**: Lặp lại một sequence of nodes

**Specific Attributes**:
- `loopCondition`: Điều kiện lặp
- `maxIterations`: Số lần lặp tối đa
- `breakCondition`: Điều kiện dừng

**Input**:
- Initial data
- Loop parameters

**Output**:
- Final result sau khi loop
- Iteration count

**Example Use Cases**:
- Retry Until Success: Retry cho đến khi pass
- Iterative Refinement: Cải thiện code qua nhiều lượt
- Batch Processing: Xử lý nhiều items

---

## III. EDGE STRUCTURE

### Edge Definition

Edge định nghĩa kết nối và data flow giữa các nodes.

### Core Attributes

**Identity**:
- `edgeId`: Unique identifier
- `sourceNode`: Node nguồn
- `targetNode`: Node đích

**Condition**:
- `condition`: Điều kiện để traverse edge
- `conditionType`: always | conditional | error

**Data Flow**:
- `dataMapping`: Map output của source thành input của target
- `transform`: Transform function nếu cần

**Priority**:
- `priority`: Thứ tự ưu tiên nếu có nhiều edges
- `weight`: Trọng số cho routing

---

## IV. GRAPH STRUCTURE

### Graph Definition

Graph là tập hợp các nodes và edges tạo thành workflow.

### Core Attributes

**Identity**:
- `graphId`: Unique identifier
- `graphName`: Tên workflow
- `graphType`: simple | complex | conditional

**Nodes & Edges**:
- `nodes`: Danh sách tất cả nodes
- `edges`: Danh sách tất cả edges
- `entryNode`: Node bắt đầu
- `exitNodes`: Danh sách nodes kết thúc

**Execution**:
- `status`: idle | running | completed | failed
- `currentNode`: Node đang execute
- `executionHistory`: Lịch sử execution
- `context`: Shared context cho tất cả nodes

**Configuration**:
- `maxExecutionTime`: Timeout tổng
- `parallelism`: Cho phép parallel execution
- `errorStrategy`: continue | abort | retry

---

## V. WORKFLOW PATTERNS

### 1. Linear Workflow (Simple Path)

```
[Start] → [LLM: Direct Execution] → [End]
```

**Nodes**:
- Node 1: LLM Node - Direct code generation

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → End (always)

**Use Case**: Simple tasks không cần planning

---

### 2. Sequential Workflow (Complex Path)

```
[Start] → [LLM: Planning] → [LLM: Analyze] → [LLM: Generate] → [Tool: Verify] → [End]
```

**Nodes**:
- Node 1: LLM Node - Create plan
- Node 2: LLM Node - Analyze code
- Node 3: LLM Node - Generate code
- Node 4: Tool Node - Run tests

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → Node 2 (always)
- Edge 3: Node 2 → Node 3 (always)
- Edge 4: Node 3 → Node 4 (always)
- Edge 5: Node 4 → End (if success)

**Use Case**: Complex tasks cần nhiều bước

---

### 3. Conditional Workflow

```
[Start] → [Decision: Complexity Check] → [LLM: Simple] → [End]
                                       → [LLM: Complex] → [End]
```

**Nodes**:
- Node 1: Decision Node - Check complexity
- Node 2: LLM Node - Simple execution
- Node 3: LLM Node - Complex execution with planning

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → Node 2 (if simple)
- Edge 3: Node 1 → Node 3 (if complex)
- Edge 4: Node 2 → End (always)
- Edge 5: Node 3 → End (always)

**Use Case**: Route khác nhau based on conditions

---

### 4. Loop Workflow

```
[Start] → [LLM: Generate] → [Tool: Test] → [Decision: Pass?] → [End]
                                                             ↓ (if fail)
                                           [LLM: Fix] ←──────┘
                                                ↓
                                           [Tool: Test] (retry)
```

**Nodes**:
- Node 1: LLM Node - Generate code
- Node 2: Tool Node - Run tests
- Node 3: Decision Node - Check test results
- Node 4: LLM Node - Fix bugs

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → Node 2 (always)
- Edge 3: Node 2 → Node 3 (always)
- Edge 4: Node 3 → End (if pass)
- Edge 5: Node 3 → Node 4 (if fail)
- Edge 6: Node 4 → Node 2 (retry, max 3 times)

**Use Case**: Iterative refinement với verification

---

### 5. Parallel Workflow

```
[Start] → [LLM: Planning] → [LLM: Analyze File A] ↘
                          → [LLM: Analyze File B]  → [Merge: Combine] → [LLM: Generate] → [End]
                          → [LLM: Analyze File C] ↗
```

**Nodes**:
- Node 1: LLM Node - Create plan
- Node 2: LLM Node - Analyze file A
- Node 3: LLM Node - Analyze file B
- Node 4: LLM Node - Analyze file C
- Node 5: Merge Node - Combine analyses
- Node 6: LLM Node - Generate code

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → Node 2 (parallel)
- Edge 3: Node 1 → Node 3 (parallel)
- Edge 4: Node 1 → Node 4 (parallel)
- Edge 5: Node 2 → Node 5 (wait for all)
- Edge 6: Node 3 → Node 5 (wait for all)
- Edge 7: Node 4 → Node 5 (wait for all)
- Edge 8: Node 5 → Node 6 (always)
- Edge 9: Node 6 → End (always)

**Use Case**: Multi-file analysis song song

---

### 6. Dynamic Workflow (Plan Updates)

```
[Start] → [LLM: Planning] → [Execute Step 1] → [Decision: Need Update?] → [Execute Step 2] → [End]
                                                                        ↓ (if yes)
                                               [LLM: Update Plan] ←─────┘
                                                       ↓
                                               [Execute Updated Steps]
```

**Nodes**:
- Node 1: LLM Node - Initial planning
- Node 2: LLM Node - Execute step 1
- Node 3: Decision Node - Check if plan update needed
- Node 4: LLM Node - Update plan
- Node 5: LLM Node - Execute step 2

**Edges**:
- Edge 1: Start → Node 1 (always)
- Edge 2: Node 1 → Node 2 (always)
- Edge 3: Node 2 → Node 3 (always)
- Edge 4: Node 3 → Node 5 (if no update needed)
- Edge 5: Node 3 → Node 4 (if update needed)
- Edge 6: Node 4 → Node 5 (always)
- Edge 7: Node 5 → End (always)

**Use Case**: Adaptive planning based on execution results

---

## VI. CONTEXT FLOW

### Shared Context

**Purpose**: Dữ liệu được share giữa tất cả nodes

**Contains**:
- User request
- Code context
- Project information
- Execution plan
- Accumulated discoveries
- Error history

**Flow**:
```
Context được pass qua mỗi node
Node có thể read và update context
Context được merge sau mỗi node execution
```

### Local State

**Purpose**: State riêng của mỗi node

**Contains**:
- Node-specific data
- Temporary variables
- Intermediate results

**Scope**: Chỉ trong node, không share

---

## VII. EXECUTION MODEL

### Execution Order

**Sequential**:
- Nodes execute theo thứ tự edges
- Node chỉ start khi dependencies complete

**Parallel**:
- Multiple nodes execute đồng thời
- Merge node đợi tất cả inputs

**Conditional**:
- Decision node quyết định path
- Chỉ execute nodes trên selected path

### State Transitions

```
Node State Flow:
pending → running → completed
                  → failed → retrying → completed
                                      → failed (max retries)
                  → skipped
```

### Error Propagation

**Strategy 1: Abort**:
- Node fails → Entire graph fails
- Cleanup và exit

**Strategy 2: Continue**:
- Node fails → Mark as failed
- Continue với remaining nodes

**Strategy 3: Retry**:
- Node fails → Retry với backoff
- Max retries → Abort hoặc Continue

**Strategy 4: Fallback**:
- Node fails → Execute fallback node
- Fallback success → Continue
- Fallback fails → Abort

---

## VIII. GRAPH COMPOSITION

### Subgraphs

**Concept**: Graph có thể chứa subgraph

**Use Case**:
- Reusable workflows
- Modular design
- Complex logic encapsulation

**Example**:
```
Main Graph:
  [Start] → [Subgraph: Analyze] → [LLM: Generate] → [End]

Subgraph "Analyze":
  [Entry] → [Tool: Read Files] → [LLM: Analyze] → [Exit]
```

### Graph Templates

**Concept**: Predefined graph patterns

**Templates**:
- Simple Execution Template
- Complex Planning Template
- Iterative Refinement Template
- Multi-file Processing Template

**Benefits**:
- Consistency
- Reusability
- Easy to maintain

---

## IX. MONITORING & DEBUGGING

### Graph Visualization

**Display**:
- All nodes và edges
- Current execution state
- Completed nodes (green)
- Running nodes (yellow)
- Failed nodes (red)
- Pending nodes (gray)

### Execution Trace

**Track**:
- Node execution order
- Input/output của mỗi node
- Duration của mỗi node
- Errors và retries
- Context changes

### Metrics

**Per Node**:
- Execution count
- Success rate
- Average duration
- Error rate

**Per Graph**:
- Total execution time
- Total cost
- Success rate
- Bottleneck nodes

---

## X. BEST PRACTICES

### Graph Design

**Do's**:
- Keep graphs simple và readable
- Use meaningful node names
- Define clear input/output schemas
- Set appropriate timeouts
- Handle errors gracefully
- Use parallel execution khi có thể

**Don'ts**:
- Tránh circular dependencies
- Không tạo quá nhiều nested subgraphs
- Không hardcode values trong nodes
- Không skip error handling
- Không tạo graphs quá phức tạp

### Node Design

**Do's**:
- Single responsibility per node
- Clear input/output contracts
- Idempotent khi có thể
- Proper error messages
- Logging execution details

**Don'ts**:
- Không mix nhiều concerns trong 1 node
- Không assume context structure
- Không ignore errors
- Không skip validation

### Context Management

**Do's**:
- Pass minimal necessary context
- Validate context structure
- Clean up unused data
- Version context schema

**Don'ts**:
- Không pass toàn bộ context nếu không cần
- Không mutate context trực tiếp
- Không store sensitive data
- Không skip context validation

---

## XI. EXAMPLE: COMPLETE WORKFLOW

### Scenario: Refactor Authentication System

**Graph Structure**:

```
[Start]
   ↓
[Decision: Complexity Check]
   ↓ (complex)
[LLM: Create Plan]
   ↓
[Tool: Find Auth Files] → [LLM: Analyze File 1] ↘
                        → [LLM: Analyze File 2]  → [Merge: Combine]
                        → [LLM: Analyze File 3] ↗
                                                    ↓
                                          [LLM: Generate Refactored Code]
                                                    ↓
                                          [Tool: Run Tests]
                                                    ↓
                                          [Decision: Tests Pass?]
                                                    ↓ (yes)        ↓ (no)
                                                 [End]      [LLM: Fix Bugs]
                                                                   ↓
                                                         [Tool: Run Tests] (retry)
```

**Nodes Detail**:

1. **Complexity Check** (Decision Node)
   - Input: User request
   - Output: "complex"
   - Next: Create Plan

2. **Create Plan** (LLM Node)
   - Input: User request + code context
   - Output: Execution plan (6 steps)
   - Next: Find Auth Files

3. **Find Auth Files** (Tool Node)
   - Input: Search query "auth"
   - Output: List of 3 files
   - Next: Parallel analysis

4. **Analyze File 1/2/3** (LLM Nodes, Parallel)
   - Input: File content
   - Output: Analysis results
   - Next: Merge

5. **Combine** (Merge Node)
   - Input: 3 analysis results
   - Output: Combined analysis
   - Next: Generate Code

6. **Generate Refactored Code** (LLM Node)
   - Input: Combined analysis
   - Output: Refactored code
   - Next: Run Tests

7. **Run Tests** (Tool Node)
   - Input: Refactored code
   - Output: Test results
   - Next: Tests Pass?

8. **Tests Pass?** (Decision Node)
   - Input: Test results
   - Output: Pass/Fail
   - Next: End (if pass) or Fix Bugs (if fail)

9. **Fix Bugs** (LLM Node)
   - Input: Test errors + code
   - Output: Fixed code
   - Next: Run Tests (retry, max 2 times)

**Total Nodes**: 9
**Total Edges**: 12
**Estimated Time**: 45-60 seconds
**Estimated Cost**: $0.20-0.30

---

## XII. SUMMARY

### Key Concepts

**Node**: Đơn vị thực thi cơ bản với input/output rõ ràng

**Edge**: Kết nối giữa nodes, định nghĩa data flow và conditions

**Graph**: Tập hợp nodes và edges tạo thành workflow hoàn chỉnh

### Benefits of Graph Approach

- Modular và reusable
- Easy to visualize
- Flexible routing
- Parallel execution
- Error handling rõ ràng
- Easy to debug và monitor

### Use Cases

- Simple tasks: Linear graph (1-2 nodes)
- Complex tasks: Sequential graph (5-10 nodes)
- Conditional logic: Branching graph
- Iterative refinement: Loop graph
- Multi-file processing: Parallel graph
- Adaptive planning: Dynamic graph
