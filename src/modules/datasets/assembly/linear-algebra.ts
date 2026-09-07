/**
 * Small, real linear algebra — just enough to solve ordinary least squares by the normal
 * equations (beta = (XᵀX)⁻¹ Xᵀy) for Channel Health's real VIF computation. The real channel
 * counts here are tiny (single digits to low tens), so plain Gaussian elimination with partial
 * pivoting is both correct and fast enough — no reason to pull in a real linear algebra library
 * for a handful of columns.
 */

/** Solves the real linear system Ax = b via Gaussian elimination with partial pivoting. Returns null if A is singular (no unique real solution) rather than dividing by zero. */
export function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]); // augmented matrix

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivotRow][col])) pivotRow = row;
    }
    if (Math.abs(m[pivotRow][col]) < 1e-10) return null;

    [m[col], m[pivotRow]] = [m[pivotRow], m[col]];

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) {
        m[row][k] -= factor * m[col][k];
      }
    }
  }

  return m.map((row, i) => row[n] / row[i]);
}

/** Xᵀ · X — a real n×n matrix from a real (rows × n) design matrix. */
export function transposeTimesSelf(x: number[][]): number[][] {
  const cols = x[0]?.length ?? 0;
  const result: number[][] = Array.from({ length: cols }, () => new Array(cols).fill(0));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < cols; j++) {
      let sum = 0;
      for (const row of x) sum += row[i] * row[j];
      result[i][j] = sum;
    }
  }
  return result;
}

/**
 * Adds a small real ridge (Tikhonov) penalty to XᵀX's diagonal, skipping the intercept term
 * (index 0) by convention — regularizing the intercept would bias the baseline itself for no
 * real reason. Used only as a real fallback when the plain normal equations are exactly singular
 * (two *other* real channels are themselves exact linear copies of each other), which otherwise
 * makes VIF undefined for every channel regressed against them, not just the collinear pair.
 * `lambda` is chosen relative to the matrix's own scale (see compute-channel-health.ts), so this
 * works the same way regardless of whether real spend is in the hundreds or the millions.
 */
export function addRidgePenalty(xtx: number[][], lambda: number): number[][] {
  return xtx.map((row, i) => row.map((value, j) => (i === j && i !== 0 ? value + lambda : value)));
}

/** Xᵀ · y — a real n-length vector. */
export function transposeTimesVector(x: number[][], y: number[]): number[] {
  const cols = x[0]?.length ?? 0;
  const result = new Array(cols).fill(0);
  for (let i = 0; i < cols; i++) {
    let sum = 0;
    for (let r = 0; r < x.length; r++) sum += x[r][i] * y[r];
    result[i] = sum;
  }
  return result;
}
