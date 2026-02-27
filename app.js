/**
 * Template: MATLAB Production Server Front End
 *
 * Replace the placeholders below with your specific:
 *   - MPS_BASE_URL: your MPS server address
 *   - ARCHIVE_NAME: your .ctf archive name
 *   - FUNCTION_NAME: the MATLAB function to call
 *   - Input gathering logic
 *   - Output handling logic
 *
 * MPS URL format: http://<server>:<port>/<archive>/<function>
 * Response data:  result.lhs.mwdata[n]  (nth output, zero-indexed)
 */

// ── Configuration ──────────────────────────────────────────────────
const MPS_BASE_URL = 'http://localhost:9910';
const ARCHIVE_NAME = 'myArchive';       // Replace with your archive name
const FUNCTION_NAME = 'myFunction';     // Replace with your function name
const NARGOUT = 3;                      // Replace with your output count

// MATLAB default color palette
const MATLAB_COLORS = [
    '#0072BD', '#D95319', '#EDB120', '#7E2F8E',
    '#77AC30', '#4DBEEE', '#A2142F'
];

// ── MPS API Helpers ────────────────────────────────────────────────

/**
 * Call a MATLAB Production Server function.
 *
 * URL format: http://<server>:<port>/<archive>/<function>
 * Response:   result.lhs.mwdata[n] for the nth output
 *
 * @param {string} archive - Archive name
 * @param {string} func - Function name
 * @param {Array} rhs - Array of {mwdata, mwsize, mwtype} objects
 * @param {number} nargout - Number of expected outputs
 * @returns {Object} lhs object with .mwdata, .mwsize, .mwtype
 */
async function callMPS(archive, func, rhs, nargout) {
    const url = `${MPS_BASE_URL}/${archive}/${func}`;
    const payload = { nargout, rhs };

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MPS HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    return result.lhs;  // Access outputs via .mwdata[0], .mwdata[1], etc.
}

// ── Payload Builders ───────────────────────────────────────────────

function mpsDouble(value) {
    return { mwdata: [value], mwsize: [1, 1], mwtype: "double" };
}

function mpsString(value) {
    return { mwdata: [value], mwsize: [1, value.length], mwtype: "char" };
}

function mpsLogical(value) {
    return { mwdata: [value], mwsize: [1, 1], mwtype: "logical" };
}

function mpsDoubleVector(arr) {
    return { mwdata: arr, mwsize: [1, arr.length], mwtype: "double" };
}

function mpsDoubleMatrix(flat, rows, cols) {
    return { mwdata: flat, mwsize: [rows, cols], mwtype: "double" };
}

// ── Response Helpers ───────────────────────────────────────────────

/** Reshape column-major flat array to 2D array */
function reshapeColumnMajor(flat, rows, cols) {
    const matrix = [];
    for (let r = 0; r < rows; r++) {
        matrix[r] = [];
        for (let c = 0; c < cols; c++) {
            matrix[r][c] = flat[r + c * rows];
        }
    }
    return matrix;
}

/** Downsample array for chart performance */
function downsample(arr, maxPoints) {
    if (arr.length <= maxPoints) return arr;
    const step = Math.ceil(arr.length / maxPoints);
    return arr.filter((_, i) => i % step === 0);
}

// ── UI Helpers ─────────────────────────────────────────────────────

function setLoading(isLoading) {
    const btn = document.getElementById('calculateBtn');
    if (btn) {
        btn.disabled = isLoading;
        btn.textContent = isLoading ? 'Computing...' : 'Calculate';
    }
}

function showError(message) {
    const el = document.getElementById('errorAlert');
    if (el) {
        el.textContent = message;
        el.classList.remove('d-none');
    }
}

function clearError() {
    const el = document.getElementById('errorAlert');
    if (el) el.classList.add('d-none');
}

// ── Main Calculate Function (CUSTOMIZE THIS) ──────────────────────

async function calculate() {
    try {
        setLoading(true);
        clearError();

        // TODO: Gather inputs from your HTML form
        // const freq = parseFloat(document.getElementById('freqInput').value);
        // const method = document.getElementById('methodSelect').value;

        // TODO: Build the rhs array matching your MATLAB function signature
        // const rhs = [
        //     mpsDouble(freq),
        //     mpsString(method),
        // ];

        // const lhs = await callMPS(ARCHIVE_NAME, FUNCTION_NAME, rhs, NARGOUT);

        // TODO: Extract outputs from lhs.mwdata[n]
        // const timeVector = lhs.mwdata[0];   // First output
        // const signalData = lhs.mwdata[1];   // Second output
        // const rmsValue   = lhs.mwdata[2];   // Third output (scalar)

        // TODO: Update your charts and displays
        // updateChart(timeVector, signalData);

    } catch (err) {
        console.error('MPS call failed:', err);
        showError(`Calculation failed: ${err.message}`);
    } finally {
        setLoading(false);
    }
}

// ── Event Binding ──────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('calculateBtn');
    if (btn) btn.addEventListener('click', calculate);
});
