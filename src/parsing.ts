export type PageMetaInfo = {
    // File name without the `.md` extension.
    id: string;
    name: string;
    birth?: string;
    death?: string;
    parents?: string[];
    children?: string[];
    spouses?: string[];
};

export function extractPageMeta(page: string, fileName: string): PageMetaInfo {
    const lines = page.split('\n').map((line) => line.trim());
    const headerEnd = lines.indexOf('---');

    if (headerEnd === -1) {
        throw new Error("invalid page: missing meta block separator ('---')");
    }

    const header = lines.slice(0, headerEnd);
    if (header.length === 0) {
        throw new Error(
            "invalid page: missing meta block name. add '# <surname> <name> <parental name>' at the start of the page",
        );
    }

    const name = lines[0];
    if (!name || name.length < 3 || !name.startsWith('# ')) {
        throw new Error(
            `invalid name value: ${name}: the value must be in format '# <surname> <name> <paternal name>'`,
        );
    }

    const birth = lines
        .find((line) => line.startsWith('**Birth**'))
        ?.split(':')[1]
        ?.trim();
    const death = lines
        .find((line) => line.startsWith('**Death**'))
        ?.split(':')[1]
        ?.trim();
    const parents = lines
        .find((line) => line.startsWith('**Parents**'))
        ?.split(':')[1]
        ?.split(',')
        .map((parent) => parent.trim());
    const children = lines
        .find((line) => line.startsWith('**Children**'))
        ?.split(':')[1]
        ?.split(',')
        .map((child) => child.trim());
    const spouses = lines
        .find((line) => line.startsWith('**Spouse(s)**'))
        ?.split(':')[1]
        ?.split(',')
        .map((spouse) => spouse.trim());

    return {
        id: fileName,
        name: name.substring(2),
        birth,
        death,
        parents,
        children,
        spouses,
    };
}
