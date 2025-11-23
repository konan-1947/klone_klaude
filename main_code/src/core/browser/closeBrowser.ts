import { BrowserState } from '../../types';

export const closeBrowser = async (state: BrowserState): Promise<void> => {
    if (state.page) {
        await state.page.close();
        state.page = null;
    }

    if (state.browser) {
        await state.browser.close();
        state.browser = null;
    }

    state.isAuthenticated = false;
};
