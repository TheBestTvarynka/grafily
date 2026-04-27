import { useContext } from 'react';
import { App } from 'obsidian';

import { AppContext } from './view/GrafilyView';
import { GraphContext, GraphContextValue } from 'view/graph';

export const useApp = (): App | undefined => {
    return useContext(AppContext);
};

export const useGraph = (): GraphContextValue | null => {
    return useContext(GraphContext);
};
