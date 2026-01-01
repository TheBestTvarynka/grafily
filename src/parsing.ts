import { Person } from 'model';

export function extractPageMeta(page: string, fileName: string, filePath: string): Person {
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

    const removeSquarePrentness = (link: string) => {
        link = link.trim();

        if (link.startsWith('[[')) {
            link = link.substring(2);
        }

        if (link.endsWith(']]')) {
            link = link.substring(0, link.length - 2);
        }

        return link;
    };

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
        .map(removeSquarePrentness);
    const children = lines
        .find((line) => line.startsWith('**Children**'))
        ?.split(':')[1]
        ?.split(',')
        .map(removeSquarePrentness);
    const spouses = lines
        .find((line) => line.startsWith('**Spouse**'))
        ?.split(':')[1]
        ?.split(',')
        .map(removeSquarePrentness);

    return {
        id: fileName,
        name: name.substring(2),
        birth,
        death,
        parents,
        children,
        spouses,
        filePath,
    };
}
