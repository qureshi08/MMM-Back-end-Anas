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
