# MPS API Reference

How to construct HTTP requests to MATLAB Production Server and handle responses.

## Endpoint URL Pattern

```
POST http://<server>:<port>/<archiveName>/<functionName>
```

Example: `POST http://localhost:9910/signalApp/generateSignal`

## JSON Request Schema

```json
{
    "nargout": 5,
    "rhs": [
        { "mwdata": [50],     "mwsize": [1, 1], "mwtype": "double" },
        { "mwdata": [1.0],    "mwsize": [1, 1], "mwtype": "double" },
        { "mwdata": [2],      "mwsize": [1, 1], "mwtype": "double" },
        { "mwdata": ["Sine"], "mwsize": [1, 4], "mwtype": "char"   }
    ]
}
```

### Fields

- **nargout**: Number of output arguments expected. Must be <= the number of outputs in the MATLAB function signature.
- **rhs**: Ordered array of input arguments matching the MATLAB function signature exactly.
- **mwdata**: The value(s) as an array. Scalars: `[50]`. Vectors: `[1, 2, 3]`. Strings: `["Sine"]`.
- **mwsize**: MATLAB dimensions as `[rows, cols]`. Scalar: `[1, 1]`. Row vector (1xN): `[1, N]`. String: `[1, numChars]`.
- **mwtype**: MATLAB data type string.

### Common Data Types

| MATLAB Type | mwtype | mwdata Example | mwsize |
|---|---|---|---|
| Scalar double | "double" | [3.14] | [1, 1] |
| Row vector 1x5 | "double" | [1, 2, 3, 4, 5] | [1, 5] |
| Column vector 5x1 | "double" | [1, 2, 3, 4, 5] | [5, 1] |
| Matrix 2x3 | "double" | [1, 4, 2, 5, 3, 6] | [2, 3] |
| String | "char" | ["Hello"] | [1, 5] |
| Logical true | "logical" | [true] | [1, 1] |
| Integer | "int32" | [42] | [1, 1] |

Matrix storage is **column-major**: `[1 2 3; 4 5 6]` -> mwdata `[1, 4, 2, 5, 3, 6]` (down each column, then next column).

### Building the Payload from HTML Inputs

```javascript
function buildPayload(inputs, nargout) {
    const rhs = [];

    for (const arg of inputs) {
        if (typeof arg.value === 'string') {
            rhs.push({
                mwdata: [arg.value],
                mwsize: [1, arg.value.length],
                mwtype: "char"
            });
        } else if (typeof arg.value === 'boolean') {
            rhs.push({
                mwdata: [arg.value],
                mwsize: [1, 1],
                mwtype: "logical"
            });
        } else if (Array.isArray(arg.value)) {
            rhs.push({
                mwdata: arg.value,
                mwsize: arg.size || [1, arg.value.length],
                mwtype: arg.type || "double"
            });
        } else {
            // Scalar numeric
            rhs.push({
                mwdata: [arg.value],
                mwsize: [1, 1],
                mwtype: arg.type || "double"
            });
        }
    }

    return { nargout, rhs };
}
```

## JSON Response Schema

The response contains an `lhs` object. Output data is accessed via `result.lhs.mwdata[n]` where `n` is the zero-based index of the output argument.

```json
{
    "lhs": {
        "mwdata": [ <output_0_data>, <output_1_data>, ... ],
        "mwsize": [<rows>, <cols>],
        "mwtype": "<type>"
    }
}
```

### Extracting Output Data

- `result.lhs.mwdata[0]` — first output argument
- `result.lhs.mwdata[1]` — second output argument
- `result.lhs.mwdata[n]` — nth output argument (zero-indexed)

For a function like `generateSignal` with 5 outputs:
- `result.lhs.mwdata[0]` — time vector (t)
- `result.lhs.mwdata[1]` — signal data
- `result.lhs.mwdata[2]` — frequency axis
- `result.lhs.mwdata[3]` — spectrum data
- `result.lhs.mwdata[4]` — RMS value (scalar)

## Complete JavaScript fetch() Pattern

```javascript
async function callMPS(archiveName, functionName, rhs, nargout) {
    const url = `http://localhost:9910/${archiveName}/${functionName}`;
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
    return result.lhs;  // Contains .mwdata, .mwsize, .mwtype
}

// Usage:
async function calculate() {
    const freq = parseFloat(document.getElementById('freqInput').value);
    const method = document.getElementById('methodSelect').value;

    try {
        setLoading(true);
        clearError();

        const lhs = await callMPS('signalApp', 'generateSignal', [
            { mwdata: [freq],   mwsize: [1, 1],             mwtype: "double" },
            { mwdata: [1.0],    mwsize: [1, 1],             mwtype: "double" },
            { mwdata: [2.0],    mwsize: [1, 1],             mwtype: "double" },
            { mwdata: [method], mwsize: [1, method.length],  mwtype: "char"   }
        ], 5);

        // Extract outputs from lhs.mwdata[n]
        const t       = lhs.mwdata[0];   // Time vector
        const signal  = lhs.mwdata[1];   // Signal data
        const freqAx  = lhs.mwdata[2];   // Frequency axis
        const spec    = lhs.mwdata[3];   // Spectrum
        const rmsVal  = lhs.mwdata[4];   // RMS scalar

        updateChart(t, signal);
        document.getElementById('rmsDisplay').textContent = `RMS: ${rmsVal.toFixed(4)}`;

    } catch (err) {
        console.error('MPS call failed:', err);
        showError(`Calculation failed: ${err.message}`);
    } finally {
        setLoading(false);
    }
}
```

## Testing with cURL

Always test the API with cURL before wiring up the front end. This isolates back-end issues from front-end issues.

```bash
# Basic test (use short duration for small response)
curl -X POST http://localhost:9910/signalApp/generateSignal \
  -H "Content-Type: application/json" \
  -d '{
    "nargout": 5,
    "rhs": [
        {"mwdata": [50],     "mwsize": [1,1], "mwtype": "double"},
        {"mwdata": [1.0],    "mwsize": [1,1], "mwtype": "double"},
        {"mwdata": [0.05],   "mwsize": [1,1], "mwtype": "double"},
        {"mwdata": ["Sine"], "mwsize": [1,4], "mwtype": "char"}
    ]
  }'

# Pretty-print with jq
curl -s -X POST http://localhost:9910/signalApp/generateSignal \
  -H "Content-Type: application/json" \
  -d '{ ... }' | jq .

# Inspect the output data
curl -s -X POST ... | jq '.lhs.mwdata'

# Check a specific output (e.g. the RMS scalar at index 4)
curl -s -X POST ... | jq '.lhs.mwdata[4]'
```

## Testing with Postman

1. Create a new POST request
2. URL: `http://localhost:9910/signalApp/generateSignal`
3. Headers: `Content-Type: application/json`
4. Body -> raw -> paste the JSON payload
5. Send and inspect `lhs.mwdata` in the response

Save requests in a Postman Collection for each MPS function. This makes regression testing easy.

## Common Errors

| HTTP Status | Meaning | Fix |
|---|---|---|
| 404 | Archive or function not found | Check .ctf is in auto_deploy, URL path matches archive/function name |
| 400 | Invalid request JSON | Verify mwtype, mwsize consistency. Check for typos in field names. |
| 500 | MATLAB runtime error | Check `<MPS_INSTALL>/log/main.log`. The function threw an error. |
| CORS error | Cross-origin blocked | Serve front end from MPS (same origin) or configure a reverse proxy |

## Discovery Endpoint

Check what functions are deployed:

```
GET http://localhost:9910/api/discovery
```

Returns JSON listing all deployed archives and their function signatures.

## CORS Handling

Three options, in order of preference:

1. **Serve front end from MPS** (same origin, no CORS needed) — see mps-deployment.md
2. **Reverse proxy** (Nginx/Apache fronts both static files and MPS)
3. **MPS CORS config** — set `--cors-allowed-origins` in `main_config` (newer MPS versions)
