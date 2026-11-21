// Small dense linear algebra helpers for Gaussian processes.
// Matrices are arrays of rows. Vectors are plain arrays or Float64Arrays.

/** Cholesky factor L (lower triangular) of a symmetric positive-definite matrix A, so that A = L * L^T. */
export function cholesky(A) {
  const n = A.length;
  const L = Array.from({ length: n }, () => new Float64Array(n));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-10));
      else L[i][j] = s / L[j][j];
    }
  }
  return L;
}

/** Solves L * y = b for lower-triangular L. */
export function solveLower(L, b) {
  const n = L.length;
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i][k] * y[k];
    y[i] = s / L[i][i];
  }
  return y;
}

/** Solves L^T * x = y for lower-triangular L. */
export function solveUpperT(L, y) {
  const n = L.length;
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k];
    x[i] = s / L[i][i];
  }
  return x;
}

/** Solves A * x = b given the Cholesky factor L of A. */
export function choleskySolve(L, b) {
  return solveUpperT(L, solveLower(L, b));
}

/** log(det(A)) given the Cholesky factor L of A. */
export function logDet(L) {
  let s = 0;
  for (let i = 0; i < L.length; i++) s += Math.log(L[i][i]);
  return 2 * s;
}
