# Kế hoạch Implement Tính năng Đăng xuất

## Tổng quan
Thêm chức năng đăng xuất (logout) cho extension, cho phép user xóa session hiện tại và đăng nhập lại với account khác.

## Phân tích hiện trạng

### Các thành phần hiện có:
1. **CookieManager** (`src/core/cookie/CookieManager.ts`)
   - Đã có method `clearCookies()` để xóa cookies
   - Có thể tái sử dụng cho logout

2. **AIStudioBrowser** (`src/core/browser/AIStudioBrowser.ts`)
   - Có method `close()` để đóng browser
   - Cần được gọi khi logout

3. **ChatViewProvider** (`src/providers/chat/ChatViewProvider.ts`)
   - Quản lý state của browser và authentication
   - Cần reset state khi logout

4. **Extension Commands** (`src/extension.ts`)
   - Hiện có command `browser-connect.initialize`
   - Cần thêm command `browser-connect.logout`

## Kế hoạch Implementation

### 1. Thêm Command Logout vào package.json

**File**: `package.json`

**Thay đổi**:
```json
"commands": [
    {
        "command": "browser-connect.initialize",
        "title": "Browser Connect: Initialize AI Studio",
        "category": "AI"
    },
    {
        "command": "browser-connect.logout",
        "title": "Browser Connect: Logout",
        "category": "AI"
    }
]
```

**Mục đích**: Đăng ký command logout với VS Code

---

### 2. Tạo function handleLogout cho ChatViewProvider

**File mới**: `src/providers/chat/handleLogout.ts`

**Nội dung**:
```typescript
import * as vscode from 'vscode';
import { AIStudioBrowser } from '../../core/browser/AIStudioBrowser';
import { CookieManager } from '../../core/cookie/CookieManager';

export const handleLogout = async (
    view: vscode.WebviewView | undefined,
    browser: AIStudioBrowser | null,
    cookieManager: CookieManager
): Promise<{ browser: null; initialized: false }> => {
    try {
        // 1. Đóng browser nếu đang mở
        if (browser) {
            await browser.close();
        }

        // 2. Xóa cookies đã lưu
        await cookieManager.clearCookies();

        // 3. Thông báo cho webview
        if (view) {
            view.webview.postMessage({
                type: 'logoutSuccess',
                message: 'Đã đăng xuất thành công'
            });
        }

        // 4. Hiển thị thông báo
        vscode.window.showInformationMessage('✅ Đã đăng xuất khỏi AI Studio');

        return {
            browser: null,
            initialized: false
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        vscode.window.showErrorMessage(`❌ Lỗi khi đăng xuất: ${errorMessage}`);
        
        return {
            browser: null,
            initialized: false
        };
    }
};
```

**Mục đích**: 
- Xử lý logic đăng xuất
- Đóng browser
- Xóa cookies
- Reset state
- Thông báo cho user

---

### 3. Cập nhật ChatViewProvider

**File**: `src/providers/chat/ChatViewProvider.ts`

**Thay đổi 1**: Import handleLogout
```typescript
import { handleLogout } from './handleLogout';
```

**Thay đổi 2**: Thêm method logout public
```typescript
public async logout(): Promise<void> {
    const result = await handleLogout(
        this._view,
        this.aiStudioBrowser,
        this.cookieManager
    );
    this.aiStudioBrowser = result.browser;
    this.isInitialized = result.initialized;
}
```

**Thay đổi 3**: Thêm case 'logout' trong message handler
```typescript
webviewView.webview.onDidReceiveMessage(async data => {
    switch (data.type) {
        case 'initialize':
            // ... existing code
            break;
        case 'sendMessage':
            // ... existing code
            break;
        case 'logout':
            await this.logout();
            break;
    }
});
```

**Mục đích**: 
- Cho phép logout từ webview
- Expose public method để command có thể gọi

---

### 4. Thêm Logout Command vào extension.ts

**File**: `src/extension.ts`

**Thay đổi 1**: Lưu reference của chatProvider
```typescript
// Thay đổi từ const thành let để có thể access từ command
let chatProvider: ChatViewProvider;

export function activate(context: vscode.ExtensionContext) {
    // ... existing code
    
    chatProvider = new ChatViewProvider(context.extensionUri, context);
    
    // ... existing code
}
```

**Thay đổi 2**: Thêm logout command
```typescript
const logoutCommand = vscode.commands.registerCommand('browser-connect.logout', async () => {
    const hasSession = await cookieManager.hasValidSession();
    
    if (!hasSession) {
        vscode.window.showInformationMessage('ℹ️ Chưa có session nào để đăng xuất');
        return;
    }

    const userEmail = await cookieManager.getUserEmail();
    const confirm = await vscode.window.showWarningMessage(
        `Bạn có chắc muốn đăng xuất khỏi account: ${userEmail || 'Unknown'}?`,
        { modal: true },
        'Đăng xuất',
        'Hủy'
    );

    if (confirm === 'Đăng xuất') {
        await chatProvider.logout();
    }
});

context.subscriptions.push(logoutCommand);
```

**Mục đích**:
- Đăng ký command logout
- Xác nhận trước khi đăng xuất
- Hiển thị email của user

---

### 5. Cập nhật Chat UI (Optional)

**File**: `src/views/chat.html`

**Thay đổi**: Thêm button Logout vào UI

```html
<!-- Thêm button logout bên cạnh hoặc dưới button Initialize -->
<button id="logoutBtn" class="logout-btn" style="display: none;">
    🚪 Đăng xuất
</button>
```

```javascript
// Thêm event listener
const logoutBtn = document.getElementById('logoutBtn');
logoutBtn.addEventListener('click', () => {
    vscode.postMessage({ type: 'logout' });
});

// Hiển thị/ẩn button dựa vào auth status
window.addEventListener('message', event => {
    const message = event.data;
    switch (message.type) {
        case 'authStatus':
            if (message.isAuthenticated) {
                logoutBtn.style.display = 'block';
            } else {
                logoutBtn.style.display = 'none';
            }
            break;
        case 'logoutSuccess':
            logoutBtn.style.display = 'none';
            // Reset UI về trạng thái chưa đăng nhập
            break;
    }
});
```

**Mục đích**: 
- Cho phép logout trực tiếp từ Chat UI
- Tự động hiển thị/ẩn button dựa vào trạng thái

---

### 6. Cập nhật checkAuthStatus

**File**: `src/providers/chat/checkAuthStatus.ts`

**Thay đổi**: Đảm bảo gửi đúng auth status cho webview

```typescript
export const checkAuthStatus = async (
    view: vscode.WebviewView | undefined,
    cookieManager: CookieManager
): Promise<void> => {
    const hasSession = await cookieManager.hasValidSession();
    const userEmail = await cookieManager.getUserEmail();

    if (view) {
        view.webview.postMessage({
            type: 'authStatus',
            isAuthenticated: hasSession,
            userEmail: userEmail
        });
    }
};
```

**Mục đích**: Cung cấp thông tin auth cho UI

---

## Thứ tự Implementation

1. ✅ **Bước 1**: Tạo file `handleLogout.ts`
2. ✅ **Bước 2**: Cập nhật `ChatViewProvider.ts`
3. ✅ **Bước 3**: Cập nhật `extension.ts`
4. ✅ **Bước 4**: Cập nhật `package.json`
5. ⚠️ **Bước 5** (Optional): Cập nhật `chat.html` để thêm UI button
6. ⚠️ **Bước 6** (Optional): Cập nhật `checkAuthStatus.ts`

## Testing Plan

### Test Cases:

1. **Test logout khi có session**:
   - Khởi tạo browser và đăng nhập
   - Chạy command logout
   - Verify: cookies bị xóa, browser đóng, UI reset

2. **Test logout khi chưa có session**:
   - Không khởi tạo browser
   - Chạy command logout
   - Verify: Hiển thị message "Chưa có session"

3. **Test logout từ UI**:
   - Click button logout trong chat panel
   - Verify: Tương tự test case 1

4. **Test logout và login lại**:
   - Logout
   - Initialize lại browser
   - Đăng nhập với account khác
   - Verify: Session mới được lưu đúng

## Lưu ý

1. **Cleanup**: Đảm bảo browser được đóng hoàn toàn trước khi xóa cookies
2. **State Management**: Reset tất cả state liên quan (browser, isInitialized)
3. **Error Handling**: Xử lý trường hợp browser đã đóng nhưng vẫn gọi logout
4. **User Confirmation**: Luôn xác nhận trước khi logout để tránh mất session nhầm
5. **UI Feedback**: Cung cấp feedback rõ ràng cho user về trạng thái logout

## Dependencies

Không cần thêm dependency mới, tất cả đều sử dụng code hiện có.
