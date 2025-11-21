# AI Studio Connector

VS Code extension để kết nối với Google AI Studio thông qua browser automation.

## Cài Đặt

1. Install dependencies:
```bash
npm install
```

2. Compile TypeScript:
```bash
npm run compile
```

3. Press F5 trong VS Code để chạy extension trong Development Mode

## Sử Dụng

1. Mở Primary Sidebar, tìm icon "AI Studio"
2. Click "Login to AI Studio"
3. Browser sẽ mở, đăng nhập vào aistudio.google.com
4. Sau khi đăng nhập xong, extension sẽ tự detect
5. Nhập prompt và click "Send Prompt"

## Cấu Trúc

- `src/extension.ts` - Extension entry point
- `src/viewProvider.ts` - WebView UI provider
- `src/aiStudioClient.ts` - WebSocket client
- `src/browserBridgeManager.ts` - Bridge process manager
- `src/bridge/` - Browser automation bridge
  - `index.ts` - Bridge entry point
  - `browserBridge.ts` - WebSocket server
  - `aiStudioBrowser.ts` - Puppeteer automation
  - `cookieManager.ts` - Session persistence

## Lưu Ý

- Browser sẽ mở ở chế độ visible (headless: false)
- Session được lưu trong `.ai-studio-storage/`
- Cookies có thời hạn 30 ngày
