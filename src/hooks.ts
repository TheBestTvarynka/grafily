import { useContext } from 'react';
import { App } from 'obsidian';

import { AppContext } from './view/GrafilyView';

export const useApp = (): App | undefined => {
    return useContext(AppContext);
};
