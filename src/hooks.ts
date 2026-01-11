import { useContext } from 'react';
import { App } from 'obsidian';

import { AppContext } from './view/GrafilyView';
import { IndexContext, IndexContextValue } from 'view/graph';

export const useApp = (): App | undefined => {
    return useContext(AppContext);
};

export const useIndex = (): IndexContextValue | null => {
    return useContext(IndexContext);
};
