// The quadprog package ships no type definitions. It is a direct port of the
// Fortran routines behind R's quadprog, so every vector and matrix it takes or
// returns is 1-based, with index 0 left unused.
declare module 'quadprog' {
    // When an argument shape check fails, solveQP returns early with nothing
    // but a message, so every result field other than `message` is optional.
    export interface SolveQPResult {
        solution?: number[];
        Lagrangian?: number[];
        value?: number[];
        unconstrained_solution?: number[];
        iterations?: number[];
        iact?: number[];
        message: string;
    }

    // Minimizes -dvec^T x + 1/2 x^T Dmat x subject to Amat^T x >= bvec, where
    // the first meq constraints are equalities. Dmat and dvec are overwritten.
    export function solveQP(
        Dmat: number[][],
        dvec: number[],
        Amat: number[][],
        bvec?: number[],
        meq?: number,
        factorized?: number[],
    ): SolveQPResult;
}
