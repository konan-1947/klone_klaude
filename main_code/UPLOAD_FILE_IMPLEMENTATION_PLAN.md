# Upload File Implementation Plan

## Tóm tắt nhanh

### Vấn đề hiện tại
Việc gõ từng ký tự bằng `page.type()` để gửi file contents lên AI Studio **rất chậm** (30-60 giây), đặc biệt khi file dài.

### Giải pháp
**Upload file** thay vì typing → Giảm thời gian xuống **5-10 giây**.

### Những gì cần làm

#### **3 files mới cần tạo:**
1. `buildContextFile.ts` - Tạo nội dung file text từ file contents
2. `uploadFile.ts` - Upload file lên AI Studio qua Puppeteer
3. `sendPromptWithFile.ts` - Orchestrate flow: build → upload → send

#### **5 files cần sửa:**
1. `constants.ts` - Thêm `SELECTORS.FILE_UPLOAD` và `TIMEOUTS.FILE_UPLOAD_DELAY`
2. `AIStudioBrowser.ts` - Thêm method `sendPromptWithFile()`
3. `AIStudioProvider.ts` - Thêm logic chọn upload/inline mode
4. `OptimizedPTKManager.ts` - Dùng upload mode thay vì typing
5. `package.json` - Thêm config cho user chọn mode

#### **1 việc cần research:**
Mở AI Studio trong browser, inspect UI để tìm selector của `input[type="file"]`

#### **Thời gian dự kiến:**
7-10 giờ (chia thành 6 phases)

---

## Mục tiêu
Thay đổi cách gửi data lên AI Studio từ **typing từng ký tự** sang **upload file**, giảm thời gian từ 30-60s xuống còn 5-10s.

## Phạm vi
- Không thay đổi logic Groq (vẫn chọn files như cũ)
- Chỉ thay đổi cách transport data đến AI Studio
- Giữ backward compatibility với typing mode

---

## Phase 1: Core Functions Implementation

### Step 1.1: Implement `buildContextFile.ts`

**File:** `src/core/browser/buildContextFile.ts`

**Chi tiết:**
```typescript
import { FileContent } from '../tools/BatchFileReader';

export const buildContextFile = (
    files: FileContent[],
    workspaceSummary: string
): string => {
    const sections: string[] = [];
    
    // Header
    sections.push('=== AI STUDIO CONTEXT FILE ===');
    sections.push(`Generated: ${new Date().toISOString()}`);
    sections.push('');
    
    // Workspace summary
    sections.push('=== WORKSPACE SUMMARY ===');
    sections.push(workspaceSummary);
    sections.push('');
    
    // File contents
    sections.push('=== FILE CONTENTS ===');
    sections.push('');
    
    for (const file of files) {
        if (file.success && file.content) {
            sections.push(`--- FILE: ${file.path} ---`);
            sections.push(file.content);
            sections.push('');
        }
    }
    
    // Footer
    sections.push('=== END OF CONTEXT ===');
    
    return sections.join('\n');
};
```

**Test cases:**
- [ ] Empty files array → Chỉ có header + summary
- [ ] Single file → Format đúng
- [ ] Multiple files → Tất cả files được include
- [ ] Files với success=false → Bỏ qua

---

### Step 1.2: Implement `uploadFile.ts`

**File:** `src/core/browser/uploadFile.ts`

**Chi tiết:**
```typescript
import { Page } from 'puppeteer';
import { logger } from '../../utils/logger';
import { SELECTORS, TIMEOUTS } from '../../utils/constants';
import { delay } from '../../utils/delay';

export const uploadFile = async (
    page: Page,
    filePath: string
): Promise<void> => {
    logger.info(`Uploading file: ${filePath}`);
    
    // Try multiple selectors
    for (const selector of SELECTORS.FILE_UPLOAD) {
        try {
            const input = await page.$(selector);
            
            if (input) {
                // Upload file
                await input.uploadFile(filePath);
                logger.info(`File uploaded successfully using selector: ${selector}`);
                
                // Wait for upload to complete
                await delay(TIMEOUTS.FILE_UPLOAD_DELAY);
                return;
            }
        } catch (error) {
            logger.debug(`Selector ${selector} failed:`, error);
        }
    }
    
    throw new Error('Could not find file upload input element');
};
```

**Test cases:**
- [ ] File exists → Upload thành công
- [ ] File không tồn tại → Throw error rõ ràng
- [ ] Selector không tìm thấy → Throw error
- [ ] Upload timeout → Handle gracefully

---

### Step 1.3: Create `sendPromptWithFile.ts`

**File:** `src/core/browser/sendPromptWithFile.ts`

**Chi tiết:**
```typescript
import { Page } from 'puppeteer';
import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { FileContent } from '../tools/BatchFileReader';
import { delay } from '../../utils/delay';
import { logger } from '../../utils/logger';
import { URLS, TIMEOUTS } from '../../utils/constants';
import { buildContextFile } from './buildContextFile';
import { uploadFile } from './uploadFile';
import { findInputElement } from './findInputElement';
import { clickSendButton } from './clickSendButton';
import { waitForResponse } from './waitForResponse';

export const sendPromptWithFile = async (
    page: Page,
    prompt: string,
    fileContents: FileContent[],
    workspaceSummary: string,
    context: vscode.ExtensionContext
): Promise<string> => {
    let tempFilePath: string | null = null;
    
    try {
        logger.info('Starting sendPromptWithFile...');
        
        // Step 1: Build context file content
        const contextContent = buildContextFile(fileContents, workspaceSummary);
        logger.info(`Context file size: ${contextContent.length} bytes`);
        
        // Step 2: Save to temp file
        const tempDir = os.tmpdir();
        tempFilePath = path.join(tempDir, `ai-context-${Date.now()}.txt`);
        await fs.promises.writeFile(tempFilePath, contextContent, 'utf-8');
        logger.info(`Temp file created: ${tempFilePath}`);
        
        // Step 3: Navigate to AI Studio
        logger.info('Navigating to AI Studio new chat...');
        await page.goto(URLS.AI_STUDIO_NEW_CHAT, {
            waitUntil: 'networkidle2',
            timeout: TIMEOUTS.PAGE_LOAD
        });
        
        await delay(TIMEOUTS.ANGULAR_RENDER_DELAY);
        
        // Step 4: Upload file
        await uploadFile(page, tempFilePath);
        
        // Step 5: Type short prompt
        const inputSelector = await findInputElement(page);
        await page.click(inputSelector);
        await delay(TIMEOUTS.INPUT_FOCUS_DELAY);
        
        // Build final prompt
        const finalPrompt = `${prompt}\n\nRefer to the uploaded context file for codebase details.`;
        
        // Use fast input method
        await page.evaluate((selector, text) => {
            const element = document.querySelector(selector) as any;
            if (element) {
                element.value = text;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }, inputSelector, finalPrompt);
        
        await delay(TIMEOUTS.AFTER_TYPE_DELAY);
        
        // Step 6: Click send
        await clickSendButton(page);
        
        // Step 7: Wait for response
        const response = await waitForResponse(page, context);
        
        logger.info('Response received successfully');
        return response;
        
    } catch (error: any) {
        logger.error('sendPromptWithFile failed:', error);
        throw new Error(`Send prompt with file failed: ${error.message}`);
    } finally {
        // Step 8: Cleanup temp file
        if (tempFilePath) {
            try {
                await fs.promises.unlink(tempFilePath);
                logger.info('Temp file cleaned up');
            } catch (error) {
                logger.warn('Failed to cleanup temp file:', error);
            }
        }
    }
};
```

**Test cases:**
- [ ] Normal flow → Upload + send thành công
- [ ] Upload fails → Throw error, cleanup file
- [ ] Send fails → Throw error, cleanup file
- [ ] Temp file cleanup → Luôn được gọi (finally block)

---

## Phase 2: Update Constants & Selectors

### Step 2.1: Research AI Studio UI

**Nhiệm vụ:** Tìm selector cho file upload input

**Cách làm:**
1. Mở browser thường (không phải Puppeteer)
2. Navigate to: https://aistudio.google.com/app/prompts/new_chat
3. Đăng nhập nếu cần
4. F12 → Elements tab
5. Tìm nút upload/attach file (thường là icon paperclip hoặc attach)
6. Inspect element đó
7. Tìm `input[type="file"]` (có thể bị ẩn với display:none)
8. Copy selector path

**Ghi chú selectors tìm được:**
```
Selector 1: ________________________________
Selector 2: ________________________________
Selector 3: ________________________________
```

---

### Step 2.2: Update `constants.ts`

**File:** `src/utils/constants.ts`

**Thay đổi:**
```typescript
export const SELECTORS = {
    INPUT: [...],
    BUTTON: [...],
    // ... existing selectors
    
    // Thêm này:
    FILE_UPLOAD: [
        'input[type="file"]',
        '[data-testid="file-upload-input"]',
        'button[aria-label*="attach"] + input[type="file"]',
        // ... thêm selectors từ Step 2.1
    ],
} as const;

export const TIMEOUTS = {
    // ... existing timeouts
    
    // Thêm này:
    FILE_UPLOAD_DELAY: 3000,  // Wait for file upload
} as const;
```

**Test:**
- [ ] Selectors được export đúng
- [ ] TypeScript không báo lỗi

---

## Phase 3: Integration với PTK Manager

### Step 3.1: Update `AIStudioBrowser.ts`

**File:** `src/core/browser/AIStudioBrowser.ts`

**Thay đổi:**
```typescript
// Import thêm
import { sendPromptWithFile } from './sendPromptWithFile';
import { FileContent } from '../tools/BatchFileReader';

// Trong class AIStudioBrowser, thêm method:
async sendPromptWithFile(
    prompt: string,
    fileContents: FileContent[],
    workspaceSummary: string
): Promise<string> {
    await this.ensureAuthenticated();
    
    return sendPromptWithFile(
        this.page,
        prompt,
        fileContents,
        workspaceSummary,
        this.context
    );
}
```

**Test:**
- [ ] Method compile thành công
- [ ] ensureAuthenticated được gọi trước

---

### Step 3.2: Update `AIStudioProvider.ts`

**File:** `src/core/llm/providers/AIStudioProvider.ts`

**Thay đổi:**
```typescript
// Trong interface CallOptions, thêm:
export interface CallOptions {
    temperature?: number;
    model?: string;
    mode?: 'inline' | 'upload';  // Thêm này
    fileContents?: FileContent[];  // Thêm này
    workspaceSummary?: string;  // Thêm này
}

// Trong method call(), thêm logic:
async call(prompt: string, options: CallOptions = {}): Promise<string> {
    // Nếu có fileContents → dùng upload mode
    if (options.fileContents && options.fileContents.length > 0) {
        return this.browser.sendPromptWithFile(
            prompt,
            options.fileContents,
            options.workspaceSummary || ''
        );
    }
    
    // Else → dùng inline mode (typing)
    return this.browser.sendPrompt(prompt);
}
```

**Test:**
- [ ] Upload mode được trigger đúng
- [ ] Inline mode vẫn hoạt động
- [ ] Backward compatible

---

### Step 3.3: Update `OptimizedPTKManager.ts`

**File:** `src/core/ptk/OptimizedPTKManager.ts`

**Thay đổi dòng 70-80:**
```typescript
// Trước:
const aiStudioPrompt = this.buildAIStudioPrompt(
    prompt,
    context.summary,
    this.batchReader.formatForPrompt(fileContents)
);

const answer = await this.aiStudioManager.call(aiStudioPrompt, {
    model: options.model,
    temperature: options.temperature || 0.7
});

// Sau:
const answer = await this.aiStudioManager.call(prompt, {
    model: options.model,
    temperature: options.temperature || 0.7,
    mode: 'upload',  // Thêm này
    fileContents: fileContents,  // Thêm này
    workspaceSummary: context.summary  // Thêm này
});
```

**Giải thích:**
- Không cần `buildAIStudioPrompt` nữa vì file contents đã ở trong file upload
- Chỉ gửi prompt gốc + metadata qua options

**Test:**
- [ ] Upload mode được dùng
- [ ] File contents được pass đúng
- [ ] Response vẫn đúng format

---

## Phase 4: Testing & Validation

### Step 4.1: Unit Tests

**File cần test:**
- [ ] `buildContextFile.ts` → Test format output
- [ ] `uploadFile.ts` → Mock Puppeteer page
- [ ] `sendPromptWithFile.ts` → Integration test với mock

**Test commands:**
```bash
npm test -- buildContextFile
npm test -- uploadFile
npm test -- sendPromptWithFile
```

---

### Step 4.2: Manual Testing

**Test Case 1: Small prompt + Small files**
- [ ] Prompt: "Explain how authentication works"
- [ ] Files: 2-3 files, <10KB total
- [ ] Expected: Upload thành công, response đúng

**Test Case 2: Small prompt + Large files**
- [ ] Prompt: "List all functions in the codebase"
- [ ] Files: 10+ files, >100KB total
- [ ] Expected: Upload thành công, response đúng

**Test Case 3: Error handling**
- [ ] Selector không tìm thấy → Error message rõ ràng
- [ ] Upload timeout → Fallback hoặc retry
- [ ] Temp file cleanup → Luôn được thực hiện

**Test Case 4: Performance**
- [ ] Measure thời gian: Navigate → Upload → Send → Response
- [ ] Expected: <10 giây total
- [ ] So sánh với typing mode: ~30-60 giây

---

### Step 4.3: Fallback Strategy

**Nếu upload fails, có thể fallback về typing:**

```typescript
// Trong AIStudioProvider.call()
async call(prompt: string, options: CallOptions = {}): Promise<string> {
    if (options.fileContents && options.fileContents.length > 0) {
        try {
            // Try upload first
            return await this.browser.sendPromptWithFile(...);
        } catch (error) {
            logger.warn('Upload failed, falling back to inline mode:', error);
            
            // Fallback to inline
            const inlinePrompt = this.buildInlinePrompt(
                prompt,
                options.fileContents,
                options.workspaceSummary
            );
            return this.browser.sendPrompt(inlinePrompt);
        }
    }
    
    return this.browser.sendPrompt(prompt);
}
```

**Test:**
- [ ] Upload fails → Fallback được trigger
- [ ] Inline mode vẫn hoạt động
- [ ] User được thông báo về fallback

---

## Phase 5: Configuration & Polish

### Step 5.1: Add Configuration

**File:** `package.json`

**Thêm config:**
```json
{
  "contributes": {
    "configuration": {
      "properties": {
        "ai-agent.sendMode": {
          "type": "string",
          "enum": ["upload", "inline", "auto"],
          "default": "auto",
          "description": "How to send context to AI Studio: upload file, inline typing, or auto-detect"
        }
      }
    }
  }
}
```

**Trong code:**
```typescript
const config = vscode.workspace.getConfiguration('ai-agent');
const sendMode = config.get<string>('sendMode', 'auto');

if (sendMode === 'upload' || (sendMode === 'auto' && shouldUseUpload)) {
    // Use upload mode
}
```

---

### Step 5.2: Add Logging & Metrics

**Thêm vào `sendPromptWithFile.ts`:**
```typescript
const metrics = {
    startTime: Date.now(),
    buildTime: 0,
    uploadTime: 0,
    sendTime: 0,
    responseTime: 0,
    totalTime: 0,
    fileSize: 0
};

// ... sau mỗi step, log metrics
logger.info('Performance metrics:', metrics);
```

---

## Phase 6: Documentation

### Step 6.1: Update STRUCTURE.md

**Thêm vào file structure:**
```markdown
├── core/
│   ├── browser/
│   │   ├── buildContextFile.ts    # Build context file for upload
│   │   ├── uploadFile.ts          # Upload file to AI Studio
│   │   ├── sendPromptWithFile.ts  # Send prompt with file upload
│   │   └── ...
```

---

## Checklist tổng quan

### Core Implementation
- [ ] Step 1.1: Implement `buildContextFile.ts`
- [ ] Step 1.2: Implement `uploadFile.ts`
- [ ] Step 1.3: Implement `sendPromptWithFile.ts`

### Research & Constants
- [ ] Step 2.1: Research AI Studio UI, tìm selectors
- [ ] Step 2.2: Update `constants.ts`

### Integration
- [ ] Step 3.1: Update `AIStudioBrowser.ts`
- [ ] Step 3.2: Update `AIStudioProvider.ts`
- [ ] Step 3.3: Update `OptimizedPTKManager.ts`

### Testing
- [ ] Step 4.1: Unit tests
- [ ] Step 4.2: Manual testing (4 test cases)
- [ ] Step 4.3: Fallback strategy

### Polish
- [ ] Step 5.1: Add configuration
- [ ] Step 5.2: Add logging & metrics

### Documentation
- [ ] Step 6.1: Update STRUCTURE.md

---

## Ước tính thời gian

| Phase | Thời gian | 
|-------|-----------|
| Phase 1: Core Functions | 2-3 giờ |
| Phase 2: Constants | 30 phút |
| Phase 3: Integration | 1-2 giờ |
| Phase 4: Testing | 2-3 giờ |
| Phase 5: Polish | 1 giờ |
| Phase 6: Docs | 30 phút |
| **Tổng** | **7-10 giờ** |

---

## Thứ tự thực hiện khuyến nghị

1. Phase 2.1 (Research selectors) → Cần làm trước để biết selectors
2. Phase 1.1 → 1.3 (Core functions) → Build foundation
3. Phase 2.2 (Update constants) → Thêm selectors
4. Phase 3 (Integration) → Kết nối mọi thứ
5. Phase 4.2 (Manual testing) → Verify hoạt động
6. Phase 4.3 (Fallback) → Safety net
7. Phase 5-6 (Polish & docs) → Finishing touches
