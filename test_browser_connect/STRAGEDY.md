# Chiến Lược Kết Nối Browser - AI Studio (Hybrid Approach)

## Tổng Quan

Document này mô tả chi tiết phương án Hybrid để kết nối VS Code Extension với AI Studio thông qua Puppeteer, xử lý authentication và session persistence.

---

## Kiến Trúc Tổng Thể

```
VS Code Extension
    ↓ (WebSocket/Child Process)
Browser Manager (Puppeteer)
    ↓ (Cookie-based Authentication)
Chrome Browser
    ↓ (Automated Interaction)
AI Studio (aistudio.google.com)
```

---

## Core Components

### 1. Cookie Manager

**Trách nhiệm:**
- Lưu/Load cookies từ extension storage
- Validate cookies
- Clear expired cookies

**Storage Location:**
```
{extensionContext.globalStoragePath}/ai-studio-session.json
```

**Cookie Structure:**
```typescript
interface StoredSession {
  cookies: Protocol.Network.Cookie[];
  savedAt: number;
  expiresAt: number;
  userEmail?: string;
}
```

**Methods:**
```typescript
class CookieManager {
  private storagePath: string;
  
  constructor(context: vscode.ExtensionContext) {
    this.storagePath = path.join(
      context.globalStoragePath,
      'ai-studio-session.json'
    );
  }

  // Lưu cookies sau khi login thành công
  async saveCookies(
    cookies: Protocol.Network.Cookie[],
    userEmail?: string
  ): Promise<void> {
    const session: StoredSession = {
      cookies,
      savedAt: Date.now(),
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
      userEmail
    };
    
    await fs.promises.mkdir(path.dirname(this.storagePath), { recursive: true });
    await fs.promises.writeFile(
      this.storagePath,
      JSON.stringify(session, null, 2)
    );
  }

  // Load cookies đã lưu
  async loadCookies(): Promise<Protocol.Network.Cookie[] | null> {
    try {
      const data = await fs.promises.readFile(this.storagePath, 'utf8');
      const session: StoredSession = JSON.parse(data);
      
      // Check expiration
      if (Date.now() > session.expiresAt) {
        await this.clearCookies();
        return null;
      }
      
      return session.cookies;
    } catch (error) {
      return null;
    }
  }

  // Xóa cookies (khi expired hoặc logout)
  async clearCookies(): Promise<void> {
    try {
      await fs.promises.unlink(this.storagePath);
    } catch {
      // File không tồn tại, ignore
    }
  }

  // Kiểm tra có session không
  async hasValidSession(): Promise<boolean> {
    const cookies = await this.loadCookies();
    return cookies !== null && cookies.length > 0;
  }

  // Lấy thông tin user từ session
  async getUserEmail(): Promise<string | null> {
    try {
      const data = await fs.promises.readFile(this.storagePath, 'utf8');
      const session: StoredSession = JSON.parse(data);
      return session.userEmail || null;
    } catch {
      return null;
    }
  }
}
```

---

### 2. AI Studio Browser Manager

**Trách nhiệm:**
- Launch và quản lý browser instance
- Ensure authentication
- Detect và handle login states
- Interact với AI Studio UI

**Browser Launch Config:**
```typescript
interface BrowserConfig {
  headless: boolean;           // false cho lần đầu login
  userDataDir?: string;        // Optional: persistent profile
  args: string[];
}

const defaultConfig: BrowserConfig = {
  headless: false,
  args: [
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-blink-features=AutomationControlled',
    '--window-size=1280,720'
  ]
};
```

**Implementation:**
```typescript
class AIStudioBrowser {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private cookieManager: CookieManager;
  private isAuthenticated: boolean = false;

  constructor(cookieManager: CookieManager) {
    this.cookieManager = cookieManager;
  }

  // Initialize browser và ensure authentication
  async initialize(): Promise<void> {
    this.browser = await puppeteer.launch(defaultConfig);
    this.page = await this.browser.newPage();
    
    // Set viewport
    await this.page.setViewport({ width: 1280, height: 720 });
    
    // Ensure authenticated
    await this.ensureAuthenticated();
  }

  // Main authentication flow
  async ensureAuthenticated(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    // Step 1: Try load saved cookies
    const savedCookies = await this.cookieManager.loadCookies();
    
    if (savedCookies && savedCookies.length > 0) {
      console.log('Found saved cookies, attempting to restore session...');
      
      // Set cookies
      await this.page.setCookie(...savedCookies);
      
      // Navigate to AI Studio
      await this.page.goto('https://aistudio.google.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      // Check if cookies still valid
      const isValid = await this.checkLoginStatus();
      
      if (isValid) {
        console.log('Session restored successfully');
        this.isAuthenticated = true;
        return;
      } else {
        console.log('Saved cookies expired, clearing...');
        await this.cookieManager.clearCookies();
      }
    }

    // Step 2: Cookies không có hoặc expired → Manual login
    await this.performManualLogin();
  }

  // Kiểm tra login status
  private async checkLoginStatus(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Wait một chút để page load
      await this.page.waitForTimeout(2000);
      
      // Check các indicators của logged-in state
      const isLoggedIn = await this.page.evaluate(() => {
        // Method 1: Check user profile element
        const userProfile = document.querySelector('[data-user-email]') ||
                           document.querySelector('[aria-label*="Account"]') ||
                           document.querySelector('.user-profile');
        
        // Method 2: Check URL (không redirect về login)
        const notOnLoginPage = !window.location.href.includes('/login') &&
                               !window.location.href.includes('/signin');
        
        // Method 3: Check specific AI Studio elements
        const hasAIStudioUI = document.querySelector('[data-prompt-input]') ||
                             document.querySelector('.prompt-editor') ||
                             document.querySelector('textarea[placeholder*="prompt"]');
        
        return (userProfile !== null || hasAIStudioUI !== null) && notOnLoginPage;
      });
      
      return isLoggedIn;
    } catch (error) {
      console.error('Error checking login status:', error);
      return false;
    }
  }

  // Manual login flow
  private async performManualLogin(): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log('Starting manual login flow...');
    
    // Navigate to AI Studio
    await this.page.goto('https://aistudio.google.com', {
      waitUntil: 'networkidle2'
    });

    // Show notification to user
    vscode.window.showInformationMessage(
      '🔐 Vui lòng đăng nhập AI Studio trong browser đang mở',
      'Đã đăng nhập'
    ).then(async (selection) => {
      if (selection === 'Đã đăng nhập') {
        // User clicked button, verify login
        const isLoggedIn = await this.checkLoginStatus();
        if (!isLoggedIn) {
          vscode.window.showWarningMessage(
            'Chưa phát hiện đăng nhập. Vui lòng thử lại.'
          );
        }
      }
    });

    // Wait for login success (check every 2 seconds)
    const loginSuccess = await this.waitForLogin();
    
    if (!loginSuccess) {
      throw new Error('Login timeout or failed');
    }

    // Save cookies for next time
    const cookies = await this.page.cookies();
    const userEmail = await this.getUserEmail();
    await this.cookieManager.saveCookies(cookies, userEmail);
    
    this.isAuthenticated = true;
    
    vscode.window.showInformationMessage('✅ Đăng nhập AI Studio thành công!');
  }

  // Wait for user to complete login
  private async waitForLogin(): Promise<boolean> {
    if (!this.page) return false;

    const maxWaitTime = 5 * 60 * 1000; // 5 minutes
    const checkInterval = 2000; // 2 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      const isLoggedIn = await this.checkLoginStatus();
      
      if (isLoggedIn) {
        return true;
      }
      
      await this.page.waitForTimeout(checkInterval);
    }

    return false;
  }

  // Extract user email from page
  private async getUserEmail(): Promise<string | undefined> {
    if (!this.page) return undefined;

    try {
      const email = await this.page.evaluate(() => {
        const emailElement = document.querySelector('[data-user-email]');
        if (emailElement) {
          return emailElement.textContent?.trim();
        }
        
        // Fallback: try to find in profile menu
        const profileButton = document.querySelector('[aria-label*="Account"]');
        return profileButton?.getAttribute('aria-label')?.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0];
      });
      
      return email || undefined;
    } catch {
      return undefined;
    }
  }

  // Send prompt to AI Studio
  async sendPrompt(prompt: string): Promise<string> {
    if (!this.page || !this.isAuthenticated) {
      throw new Error('Not authenticated');
    }

    // Navigate to new prompt page
    await this.page.goto('https://aistudio.google.com/app/prompts/new', {
      waitUntil: 'networkidle2'
    });

    // Wait for prompt input
    await this.page.waitForSelector('textarea, [contenteditable="true"]', {
      timeout: 10000
    });

    // Type prompt
    const inputSelector = 'textarea, [contenteditable="true"]';
    await this.page.type(inputSelector, prompt);

    // Click submit button
    const submitButton = await this.page.waitForSelector(
      'button[type="submit"], button:has-text("Run"), [aria-label*="Run"]',
      { timeout: 5000 }
    );
    
    if (submitButton) {
      await submitButton.click();
    } else {
      // Fallback: press Enter
      await this.page.keyboard.press('Enter');
    }

    // Wait for response
    const response = await this.waitForResponse();
    
    return response;
  }

  // Wait for AI Studio response
  private async waitForResponse(): Promise<string> {
    if (!this.page) {
      throw new Error('Page not initialized');
    }

    // Wait for response container
    await this.page.waitForSelector('[data-response], .response-container', {
      timeout: 60000 // 1 minute max
    });

    // Wait a bit for streaming to complete
    await this.page.waitForTimeout(2000);

    // Extract response text
    const responseText = await this.page.evaluate(() => {
      const responseElement = document.querySelector('[data-response], .response-container');
      return responseElement?.textContent?.trim() || '';
    });

    return responseText;
  }

  // Cleanup
  async close(): Promise<void> {
    if (this.page) {
      await this.page.close();
      this.page = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.isAuthenticated = false;
  }
}
```

---

### 3. Communication Bridge

**Trách nhiệm:**
- Kết nối Extension và Browser Manager
- Handle requests/responses
- Manage browser lifecycle

**Architecture:**
```
Extension (Main Thread)
    ↓ (WebSocket)
Browser Bridge (WebSocket Server)
    ↓ (Direct Call)
AI Studio Browser Manager
    ↓ (Puppeteer)
Chrome Browser
```

**Implementation:**
```typescript
class BrowserBridge {
  private wss: WebSocket.Server | null = null;
  private client: WebSocket | null = null;
  private aiStudioBrowser: AIStudioBrowser | null = null;
  private cookieManager: CookieManager;
  private isReady: boolean = false;

  constructor(cookieManager: CookieManager) {
    this.cookieManager = cookieManager;
  }

  // Start WebSocket server
  async start(port: number = 3000): Promise<void> {
    this.wss = new WebSocket.Server({ port });
    
    console.log(`Browser Bridge started on ws://localhost:${port}`);

    this.wss.on('connection', (ws) => {
      console.log('Extension connected');
      this.client = ws;

      ws.on('message', async (message) => {
        await this.handleMessage(message.toString());
      });

      ws.on('close', () => {
        console.log('Extension disconnected');
        this.client = null;
      });

      // Send ready status
      this.sendToExtension({
        type: 'status',
        data: { ready: this.isReady }
      });
    });
  }

  // Initialize browser
  async initializeBrowser(): Promise<void> {
    this.aiStudioBrowser = new AIStudioBrowser(this.cookieManager);
    await this.aiStudioBrowser.initialize();
    this.isReady = true;

    this.sendToExtension({
      type: 'status',
      data: { ready: true, message: 'Browser initialized' }
    });
  }

  // Handle messages from extension
  private async handleMessage(message: string): Promise<void> {
    try {
      const { type, data, requestId } = JSON.parse(message);

      switch (type) {
        case 'init':
          await this.initializeBrowser();
          this.sendToExtension({
            type: 'response',
            requestId,
            data: { success: true }
          });
          break;

        case 'sendPrompt':
          if (!this.aiStudioBrowser || !this.isReady) {
            throw new Error('Browser not ready');
          }
          
          const response = await this.aiStudioBrowser.sendPrompt(data.prompt);
          
          this.sendToExtension({
            type: 'response',
            requestId,
            data: { response }
          });
          break;

        case 'checkAuth':
          const hasSession = await this.cookieManager.hasValidSession();
          const userEmail = await this.cookieManager.getUserEmail();
          
          this.sendToExtension({
            type: 'response',
            requestId,
            data: { authenticated: hasSession, userEmail }
          });
          break;

        case 'logout':
          await this.cookieManager.clearCookies();
          if (this.aiStudioBrowser) {
            await this.aiStudioBrowser.close();
            this.aiStudioBrowser = null;
            this.isReady = false;
          }
          
          this.sendToExtension({
            type: 'response',
            requestId,
            data: { success: true }
          });
          break;

        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (error) {
      this.sendToExtension({
        type: 'error',
        data: { message: error.message }
      });
    }
  }

  // Send message to extension
  private sendToExtension(message: any): void {
    if (this.client && this.client.readyState === WebSocket.OPEN) {
      this.client.send(JSON.stringify(message));
    }
  }

  // Cleanup
  async stop(): Promise<void> {
    if (this.aiStudioBrowser) {
      await this.aiStudioBrowser.close();
    }

    if (this.wss) {
      this.wss.close();
    }
  }
}
```

---

### 4. Extension Client

**Trách nhiệm:**
- Connect to Browser Bridge
- Send prompts
- Receive responses
- Handle UI updates

**Implementation:**
```typescript
class AIStudioClient {
  private ws: WebSocket | null = null;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();

  // Connect to browser bridge
  async connect(url: string = 'ws://localhost:3000'): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('Connected to Browser Bridge');
        resolve();
      });

      this.ws.on('message', (data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Disconnected from Browser Bridge');
        this.ws = null;
      });
    });
  }

  // Handle incoming messages
  private handleMessage(message: string): void {
    const { type, requestId, data } = JSON.parse(message);

    if (type === 'response' && requestId !== undefined) {
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        pending.resolve(data);
        this.pendingRequests.delete(requestId);
      }
    } else if (type === 'error') {
      // Broadcast error to all pending requests
      this.pendingRequests.forEach((pending) => {
        pending.reject(new Error(data.message));
      });
      this.pendingRequests.clear();
    } else if (type === 'status') {
      console.log('Browser status:', data);
    }
  }

  // Send request and wait for response
  private async sendRequest(type: string, data: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Not connected to Browser Bridge');
    }

    const requestId = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });

      this.ws!.send(JSON.stringify({
        type,
        requestId,
        data
      }));

      // Timeout after 2 minutes
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error('Request timeout'));
        }
      }, 120000);
    });
  }

  // Initialize browser
  async initialize(): Promise<void> {
    await this.sendRequest('init', {});
  }

  // Send prompt to AI Studio
  async sendPrompt(prompt: string): Promise<string> {
    const result = await this.sendRequest('sendPrompt', { prompt });
    return result.response;
  }

  // Check authentication status
  async checkAuth(): Promise<{ authenticated: boolean; userEmail?: string }> {
    return await this.sendRequest('checkAuth', {});
  }

  // Logout
  async logout(): Promise<void> {
    await this.sendRequest('logout', {});
  }

  // Disconnect
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

---

## Workflow Chi Tiết

### First Time Setup (Lần đầu sử dụng)

```
1. User activate extension command
   ↓
2. Extension → Start Browser Bridge (separate process)
   ↓
3. Extension → Connect to Bridge via WebSocket
   ↓
4. Extension → Send 'init' command
   ↓
5. Bridge → Launch Puppeteer browser (headless: false)
   ↓
6. Bridge → Check for saved cookies
   ↓ (không có cookies)
7. Bridge → Navigate to aistudio.google.com
   ↓
8. Bridge → Show notification: "Vui lòng đăng nhập"
   ↓
9. User → Đăng nhập manually trong browser
   ↓
10. Bridge → Detect login success (polling every 2s)
    ↓
11. Bridge → Extract cookies
    ↓
12. Bridge → Save cookies to storage
    ↓
13. Bridge → Send 'ready' status to Extension
    ↓
14. Extension → Show success message
    ↓
15. Ready to use!
```

### Subsequent Uses (Lần sau)

```
1. User activate extension command
   ↓
2. Extension → Start Browser Bridge
   ↓
3. Extension → Connect via WebSocket
   ↓
4. Extension → Send 'init' command
   ↓
5. Bridge → Launch browser
   ↓
6. Bridge → Load saved cookies
   ↓
7. Bridge → Set cookies in browser
   ↓
8. Bridge → Navigate to aistudio.google.com
   ↓
9. Bridge → Check login status
   ↓ (cookies valid)
10. Bridge → Send 'ready' status
    ↓
11. Ready to use! (no manual login needed)
```

### Send Prompt Flow

```
1. User → Type prompt in VS Code
   ↓
2. Extension → Send 'sendPrompt' via WebSocket
   ↓
3. Bridge → Forward to AIStudioBrowser
   ↓
4. AIStudioBrowser → Navigate to new prompt page
   ↓
5. AIStudioBrowser → Type prompt in textarea
   ↓
6. AIStudioBrowser → Click submit button
   ↓
7. AIStudioBrowser → Wait for response (max 60s)
   ↓
8. AIStudioBrowser → Extract response text
   ↓
9. Bridge → Send response back via WebSocket
   ↓
10. Extension → Display response in editor
```

### Session Expired Flow

```
1. Extension → Send 'sendPrompt'
   ↓
2. Bridge → Load cookies and navigate
   ↓
3. AIStudioBrowser → Check login status
   ↓ (cookies expired)
4. AIStudioBrowser → Clear saved cookies
   ↓
5. AIStudioBrowser → Trigger manual login flow
   ↓
6. User → Login again
   ↓
7. AIStudioBrowser → Save new cookies
   ↓
8. Continue with prompt sending
```

---

## Error Handling

### 1. Connection Errors

```typescript
// Extension side
try {
  await client.connect('ws://localhost:3000');
} catch (error) {
  vscode.window.showErrorMessage(
    'Không thể kết nối Browser Bridge. Đảm bảo bridge đang chạy.'
  );
  
  // Offer to start bridge automatically
  const action = await vscode.window.showInformationMessage(
    'Bạn có muốn khởi động Browser Bridge?',
    'Có', 'Không'
  );
  
  if (action === 'Có') {
    await startBrowserBridge();
    await client.connect();
  }
}
```

### 2. Authentication Errors

```typescript
// Browser side
try {
  await this.ensureAuthenticated();
} catch (error) {
  if (error.message.includes('timeout')) {
    vscode.window.showErrorMessage(
      'Timeout khi đợi đăng nhập. Vui lòng thử lại.'
    );
  } else {
    vscode.window.showErrorMessage(
      `Lỗi authentication: ${error.message}`
    );
  }
  
  // Clear cookies và retry
  await this.cookieManager.clearCookies();
  throw error;
}
```

### 3. Network Errors

```typescript
// Retry logic
async function navigateWithRetry(
  page: Page,
  url: string,
  maxRetries: number = 3
): Promise<void> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      return;
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      console.log(`Retry ${i + 1}/${maxRetries}...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
```

### 4. Rate Limiting

```typescript
// Detect và handle rate limit
const isRateLimited = await page.evaluate(() => {
  return document.body.textContent?.includes('Too many requests') ||
         document.body.textContent?.includes('Rate limit');
});

if (isRateLimited) {
  const waitTime = 60000; // 1 minute
  
  vscode.window.showWarningMessage(
    `AI Studio rate limit. Chờ ${waitTime / 1000}s...`
  );
  
  await new Promise(resolve => setTimeout(resolve, waitTime));
  
  // Retry
  return await this.sendPrompt(prompt);
}
```

---

## Configuration

### Extension Settings

```json
{
  "aiStudio.bridge.port": 3000,
  "aiStudio.bridge.autoStart": true,
  "aiStudio.session.persistCookies": true,
  "aiStudio.session.cookieExpiration": 2592000000,
  "aiStudio.auth.loginTimeout": 300000,
  "aiStudio.browser.headless": false,
  "aiStudio.browser.userDataDir": "",
  "aiStudio.response.timeout": 60000,
  "aiStudio.retry.maxAttempts": 3,
  "aiStudio.retry.backoffMs": 2000
}
```

### Environment Variables

```bash
# Browser Bridge
AI_STUDIO_PORT=3000
AI_STUDIO_HEADLESS=false
AI_STUDIO_DEBUG=true

# Storage
AI_STUDIO_STORAGE_PATH=~/.vscode/ai-studio
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('CookieManager', () => {
  it('should save and load cookies', async () => {
    const manager = new CookieManager(mockContext);
    const cookies = [{ name: 'test', value: 'value' }];
    
    await manager.saveCookies(cookies);
    const loaded = await manager.loadCookies();
    
    expect(loaded).toEqual(cookies);
  });

  it('should return null for expired cookies', async () => {
    // Test expired session
  });
});

describe('AIStudioBrowser', () => {
  it('should detect login status correctly', async () => {
    // Test login detection
  });

  it('should handle session restoration', async () => {
    // Test cookie restoration
  });
});
```

### Integration Tests

```typescript
describe('End-to-End Flow', () => {
  it('should complete full authentication flow', async () => {
    // 1. Start bridge
    // 2. Connect extension
    // 3. Initialize browser
    // 4. Verify ready status
  });

  it('should send prompt and receive response', async () => {
    // Full prompt flow test
  });
});
```

---

## Performance Optimization

### 1. Browser Reuse

```typescript
// Keep browser instance alive
class BrowserPool {
  private browser: Browser | null = null;
  private lastUsed: number = 0;
  private maxIdleTime: number = 5 * 60 * 1000; // 5 minutes

  async getBrowser(): Promise<Browser> {
    if (this.browser && Date.now() - this.lastUsed < this.maxIdleTime) {
      this.lastUsed = Date.now();
      return this.browser;
    }

    // Close old browser
    if (this.browser) {
      await this.browser.close();
    }

    // Launch new browser
    this.browser = await puppeteer.launch(config);
    this.lastUsed = Date.now();
    return this.browser;
  }
}
```

### 2. Cookie Caching

```typescript
// Cache cookies in memory
class CookieCache {
  private cache: Protocol.Network.Cookie[] | null = null;
  private cacheTime: number = 0;
  private cacheTTL: number = 60000; // 1 minute

  async getCookies(manager: CookieManager): Promise<Protocol.Network.Cookie[] | null> {
    if (this.cache && Date.now() - this.cacheTime < this.cacheTTL) {
      return this.cache;
    }

    this.cache = await manager.loadCookies();
    this.cacheTime = Date.now();
    return this.cache;
  }
}
```

### 3. Lazy Initialization

```typescript
// Chỉ initialize browser khi cần
class LazyBrowser {
  private browser: AIStudioBrowser | null = null;

  async ensureBrowser(): Promise<AIStudioBrowser> {
    if (!this.browser) {
      this.browser = new AIStudioBrowser(cookieManager);
      await this.browser.initialize();
    }
    return this.browser;
  }
}
```

---

## Security Considerations

### 1. Cookie Storage

```typescript
// Encrypt cookies before saving
import * as crypto from 'crypto';

class SecureCookieManager extends CookieManager {
  private encryptionKey: Buffer;

  constructor(context: vscode.ExtensionContext) {
    super(context);
    // Derive key from machine ID
    this.encryptionKey = crypto.scryptSync(
      vscode.env.machineId,
      'salt',
      32
    );
  }

  async saveCookies(cookies: Protocol.Network.Cookie[]): Promise<void> {
    const encrypted = this.encrypt(JSON.stringify(cookies));
    await fs.promises.writeFile(this.storagePath, encrypted);
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  }
}
```

### 2. WebSocket Security

```typescript
// Add authentication token
class SecureBridge extends BrowserBridge {
  private authToken: string;

  constructor(cookieManager: CookieManager) {
    super(cookieManager);
    this.authToken = crypto.randomBytes(32).toString('hex');
  }

  async start(port: number): Promise<void> {
    this.wss = new WebSocket.Server({ port });

    this.wss.on('connection', (ws, req) => {
      // Verify token
      const token = new URL(req.url!, `ws://localhost:${port}`).searchParams.get('token');
      
      if (token !== this.authToken) {
        ws.close(1008, 'Unauthorized');
        return;
      }

      // Continue with normal flow
    });
  }

  getConnectionUrl(): string {
    return `ws://localhost:3000?token=${this.authToken}`;
  }
}
```

---

## Monitoring và Logging

### 1. Structured Logging

```typescript
class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  info(message: string, data?: any): void {
    console.log(JSON.stringify({
      level: 'info',
      context: this.context,
      message,
      data,
      timestamp: new Date().toISOString()
    }));
  }

  error(message: string, error?: Error): void {
    console.error(JSON.stringify({
      level: 'error',
      context: this.context,
      message,
      error: error?.message,
      stack: error?.stack,
      timestamp: new Date().toISOString()
    }));
  }
}
```

### 2. Metrics Collection

```typescript
class Metrics {
  private stats = {
    promptsSent: 0,
    promptsFailed: 0,
    avgResponseTime: 0,
    loginAttempts: 0,
    sessionRestored: 0
  };

  recordPrompt(success: boolean, responseTime: number): void {
    if (success) {
      this.stats.promptsSent++;
      this.stats.avgResponseTime = 
        (this.stats.avgResponseTime * (this.stats.promptsSent - 1) + responseTime) / 
        this.stats.promptsSent;
    } else {
      this.stats.promptsFailed++;
    }
  }

  getStats(): any {
    return { ...this.stats };
  }
}
```

---

## Deployment

### 1. Package Structure

```
extension/
├── src/
│   ├── extension.ts          # Main extension entry
│   ├── aiStudioClient.ts     # WebSocket client
│   └── commands/
│       └── sendPrompt.ts
├── browser-bridge/
│   ├── index.ts              # Bridge entry point
│   ├── cookieManager.ts
│   ├── aiStudioBrowser.ts
│   └── browserBridge.ts
├── package.json
└── README.md
```

### 2. Build Script

```json
{
  "scripts": {
    "compile": "tsc -p ./",
    "watch": "tsc -watch -p ./",
    "build:bridge": "tsc -p ./browser-bridge/tsconfig.json",
    "package": "vsce package",
    "test": "npm run compile && node ./out/test/runTest.js"
  }
}
```

### 3. Extension Activation

```typescript
export async function activate(context: vscode.ExtensionContext) {
  const cookieManager = new CookieManager(context);
  const client = new AIStudioClient();

  // Start browser bridge in background
  const bridgeProcess = spawn('node', [
    path.join(context.extensionPath, 'out/browser-bridge/index.js')
  ]);

  // Wait for bridge to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Connect to bridge
  await client.connect();

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('aiStudio.sendPrompt', async () => {
      const prompt = await vscode.window.showInputBox({
        prompt: 'Nhập prompt cho AI Studio'
      });

      if (prompt) {
        const response = await client.sendPrompt(prompt);
        vscode.window.showInformationMessage(response);
      }
    })
  );

  // Cleanup on deactivate
  context.subscriptions.push({
    dispose: () => {
      client.disconnect();
      bridgeProcess.kill();
    }
  });
}
```

---

## Roadmap

### Phase 1: MVP
- Basic cookie persistence
- Manual login flow
- Simple prompt sending
- WebSocket communication

### Phase 2: Enhanced
- Automatic session refresh
- Better error handling
- Streaming responses
- Multiple concurrent requests

### Phase 3: Advanced
- Encrypted cookie storage
- Browser pool management
- Performance metrics
- Advanced retry strategies
- Headless mode support

---

## Summary

Hybrid approach kết hợp:
- Cookie persistence cho UX tốt
- Manual login fallback cho reliability
- WebSocket cho real-time communication
- Proper error handling và retry logic
- Security best practices
- Performance optimization

Kết quả: Hệ thống robust, user-friendly, và maintainable.
