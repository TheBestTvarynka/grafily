/**
 * A dense matrix in the shape `quadprog` expects.
 *
 * `quadprog` is a direct port of the Fortran routines behind R's quadprog, so every matrix it
 * takes is 1-based: row 0 and column 0 are allocated but never read. It also reads every cell of
 * every row, so the matrices must be dense - the zeros cannot be left as holes.
 *
 * This class exists only to keep that convention, and the bounds checks that
 * `noUncheckedIndexedAccess` demands, in one place.
 */
export class DenseMatrix {
    private readonly rows: number[][];

    /**
     * Allocates a zero-filled `(rows + 1) x (columns + 1)` matrix. The extra row and column are
     * the unused 1-based padding.
     *
     * @param {number} rows - The number of rows, not counting the padding one.
     * @param {number} columns - The number of columns, not counting the padding one.
     */
    constructor(rows: number, columns: number) {
        this.rows = [];

        for (let row = 0; row <= rows; row++) {
            this.rows.push(new Array<number>(columns + 1).fill(0));
        }
    }

    /**
     * Writes a value into the cell.
     *
     * @param {number} row - The row index.
     * @param {number} column - The column index.
     * @param {number} value - The value to write.
     */
    set(row: number, column: number, value: number): void {
        this.cells(row, column)[column] = value;
    }

    /**
     * Adds a value to the cell. Every cell starts at zero, so the first `add` is a `set`.
     *
     * @param {number} row - The row index.
     * @param {number} column - The column index.
     * @param {number} value - The value to add.
     */
    add(row: number, column: number, value: number): void {
        const cells = this.cells(row, column);

        // The row is zero-filled and the column is bounds-checked, so the fallback is never taken.
        cells[column] = (cells[column] ?? 0) + value;
    }

    /**
     * Returns the underlying array, ready to be passed to `solveQP`.
     *
     * @returns {number[][]} - The matrix rows, including the unused 1-based padding.
     */
    raw(): number[][] {
        return this.rows;
    }

    private cells(row: number, column: number): number[] {
        const cells = this.rows[row];

        if (!cells || column < 0 || column >= cells.length) {
            throw new Error(`Cell (${row}; ${column}) is out of the matrix bounds`);
        }

        return cells;
    }
}
