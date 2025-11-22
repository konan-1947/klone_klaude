# Cấu trúc Project

## Tổng quan
Project được tổ chức theo kiến trúc phân tầng với mỗi function nằm trong file riêng biệt.

## Cấu trúc Folder

```
src/
├── extension.ts                 # Entry point
│
├── types/                       # Type definitions
│   └── index.ts                 # Interfaces & types chung
│
├── utils/                       # Utilities
│   ├── constants.ts             # Hằng số (timeouts, URLs, selectors)
│   ├── delay.ts                 # Delay utility function
│   ├── logger.ts                # Logger utility
│   └── paths.ts                 # Path utilities
│
├── core/                        # Core business logic
│   ├── cookie/                  # Cookie management
│   │   ├── CookieManager.ts     # Class chính
│   │   ├── saveCookies.ts       # Lưu cookies
│   │   ├── loadCookies.ts       # Load cookies
│   │   ├── clearCookies.ts      # Xóa cookies
│   │   ├── hasValidSession.ts   # Kiểm tra session hợp lệ
│   │   └── getUserEmail.ts      # Lấy user email
│   │
│   └── browser/                 # Browser automation
│       ├── AIStudioBrowser.ts   # Class chính
│       ├── initializeBrowser.ts # Khởi tạo browser
│       ├── checkLoginStatus.ts  # Kiểm tra đăng nhập
│       ├── getUserEmailFromPage.ts # Lấy email từ page
│       ├── waitForLogin.ts      # Đợi user login
│       ├── performManualLogin.ts # Xử lý manual login
│       ├── ensureAuthenticated.ts # Đảm bảo authenticated
│       ├── findInputElement.ts  # Tìm input element
│       ├── clickSendButton.ts   # Click send button
│       ├── sendPrompt.ts        # Gửi prompt
│       ├── extractResponseText.ts # Extract response
│       ├── waitForResponse.ts   # Đợi response
│       └── closeBrowser.ts      # Đóng browser
│
├── providers/                   # VSCode providers
│   └── chat/                    # Chat provider
│       ├── ChatViewProvider.ts  # Class chính
│       ├── getHtmlForWebview.ts # Get HTML
│       ├── checkAuthStatus.ts   # Check auth
│       ├── initializeBrowserForChat.ts # Init browser
│       └── handleSendMessage.ts # Handle message
│
└── views/                       # UI views
    └── chat.html                # Chat UI HTML
```

## Nguyên tắc tổ chức

1. **Mỗi file = 1 function chính**: Dễ tìm, dễ test, dễ maintain
2. **Phân tầng rõ ràng**: 
   - `types/`: Definitions
   - `utils/`: Helpers
   - `core/`: Business logic
   - `providers/`: VSCode integration
   - `views/`: UI
3. **Tên file = tên function**: Dễ nhận biết mục đích
4. **Class file tập hợp functions**: Class chính import và sử dụng các functions đã tách

## Dependencies Flow

```
extension.ts
  └─> providers/chat/ChatViewProvider.ts
       ├─> core/browser/AIStudioBrowser.ts
       │    └─> core/browser/* functions
       └─> core/cookie/CookieManager.ts
            └─> core/cookie/* functions
```
