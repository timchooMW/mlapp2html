---
name: mlapp-to-mps
description: "Convert MATLAB Web Apps (.mlapp) to HTML/CSS/JavaScript front ends backed by MATLAB Production Server (MPS) APIs. Use this skill whenever the user wants to migrate a MATLAB app or .mlapp to a web application, separate MATLAB UI logic from algorithmic logic, create an HTML front end for a MATLAB function, deploy a MATLAB function to Production Server, construct MPS JSON payloads (rhs/lhs/mwdata/mwsize/mwtype), compile a .ctf archive, call MATLAB Production Server from JavaScript, replace MATLAB plots with Chart.js or Plotly.js, or set up MPS static file serving. Also trigger when the user mentions 'mlapp migration', 'MATLAB web app conversion', 'MPS API', 'Production Server deployment', 'ctf archive', or asks about structuring mwdata/mwsize payloads. Even if the user just says 'I have a MATLAB app and want to make it a web app', use this skill."
license: MIT
---

# MATLAB Web App → HTML + MPS Migration Skill

This skill guides the conversion of MATLAB Web Apps (.mlapp) into decoupled architectures: an HTML/CSS/JS front end + MATLAB Production Server (MPS) back end.

## Architecture Overview

A MATLAB Web App bundles UI rendering and computational logic into a single artifact. This migration decouples them into:

- **Front end** — HTML/CSS/JavaScript served from any HTTP server, giving full creative control over the UX.
- **Back end** — The core MATLAB algorithm compiled into a `.ctf` archive and deployed to MPS, exposed as a RESTful API.

This separation means the front end is lighter and more customizable, the MATLAB computation scales independently, and the two layers can be developed and maintained by different teams.

## Workflow Overview

The migration follows these phases. For each phase, detailed reference material is available in the `references/` directory.

| Phase | What Happens | Reference File |
|-------|-------------|----------------|
| 1. Document | Screenshot every interaction of the original .mlapp | — |
| 2. Extract | Separate UI logic from algorithmic logic into a standalone .m function | `references/callback-extraction.md` |
| 3. Build UI | Create the HTML/CSS/JS front end | `references/frontend-guide.md` |
| 4. Charts | Replace MATLAB plots with Chart.js or Plotly.js | `references/frontend-guide.md` |
| 5. Compile | Package the function into a .ctf archive | `references/mps-deployment.md` |
| 6. Deploy | Deploy .ctf to MPS and configure the server | `references/mps-deployment.md` |
| 7. Connect | Wire the front end to the MPS API via fetch() | `references/mps-api.md` |
| 8. Debug | Test with cURL/Postman, inspect response lhs array | `references/mps-api.md` |
| 9. Serve | Deploy front end via MPS static serving or external server | `references/mps-deployment.md` |

## How to Use This Skill

### When the user provides a screenshot of their .mlapp

1. Analyze the screenshot to identify all UI components (text fields, dropdowns, sliders, buttons, plot axes, tables, labels).
2. Map each component to its HTML equivalent.
3. Read `references/frontend-guide.md` and build the HTML/CSS/JS front end. Use Bootstrap 5 for layout.
4. For each plot/axes area, use Chart.js (simple 2D) or Plotly.js (3D, heatmaps, contours). Refer to the chart library comparison and MATLAB color table in `references/frontend-guide.md`.

### When the user provides .mlapp callback code

1. Read `references/callback-extraction.md` for the extraction pattern, including the worked examples for complex callbacks (multiple plots, table output, shared state).
2. Identify the three zones in the callback: UI Read, Algorithm, UI Write.
3. Extract the Algorithm zone into a standalone MATLAB function with explicit inputs and outputs.
4. Write the function with full documentation (inputs, outputs, types, sizes).
5. Add input validation with `otherwise` clauses and `validateattributes` where appropriate.
6. Provide a test snippet the user can run from the MATLAB command window.

### When the user wants to deploy to MPS

1. Read `references/mps-deployment.md` for compilation and deployment steps.
2. Help compile the function using `productionServerCompiler`, `compiler.build.productionServerArchive`, or `mcc`.
3. Guide deployment to the `auto_deploy` folder.
4. Help configure `main_config` if static file serving is needed.

### When the user needs to wire up the API call

1. Read `references/mps-api.md` for the JSON schema, fetch() pattern, and response handling.
2. Construct the JSON payload with correct `rhs`, `mwdata`, `mwsize`, `mwtype` fields.
3. Write the JavaScript `fetch()` call and response parser.
4. Always suggest testing with cURL or Postman first before integrating with the front end.

## Prompting Strategy for Iterative Conversion

When helping users who are building the conversion step by step, encourage them to work in this order and provide one screenshot per interaction:

1. **Screenshot of initial state** → Generate HTML skeleton with Bootstrap 5
2. **Screenshot of filled inputs** → Verify all form fields are captured with correct types
3. **Callback code** → Extract standalone MATLAB function
4. **Screenshot of plot output** → Create Chart.js/Plotly.js equivalent
5. **Function ready** → Help compile to .ctf, construct the MPS JSON payload
6. **API working via cURL** → Wire up the JavaScript fetch() call
7. **Side-by-side comparison** → Polish styling to match original

## Quick Reference: MPS JSON Schema

**IMPORTANT — MPS URL format:** The endpoint URL does NOT contain `/api/v4/`. The correct pattern is:

```
POST http://<server>:<port>/<archiveName>/<functionName>
```

Example: `POST http://localhost:9910/signalApp/generateSignal`

### Input Payload

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

**Simplified form** — for simple cases where you don't need to specify size or type, you can send a flat rhs array:

```json
{"nargout": 1, "rhs": [308.0, 2.4, 3.5, "Step"]}
```

### Response Structure

MPS returns an `lhs` array where each element corresponds to one output argument:

```json
{
    "lhs": [
        { "mwdata": [0, 0.001, 0.002, ...], "mwsize": [1, 2001], "mwtype": "double" },
        { "mwdata": [0, 0.309, 0.588, ...], "mwsize": [1, 2001], "mwtype": "double" },
        { "mwdata": [0.7071],                "mwsize": [1, 1],    "mwtype": "double" }
    ]
}
```

Key facts:
- `lhs[0]` is the first output argument, `lhs[1]` is the second, and so on
- The actual data values are in `lhs[n].mwdata`
- For scalar outputs, the value is `lhs[n].mwdata[0]`
- `lhs[n].mwsize` gives MATLAB dimensions — a 1×1000 row vector is `[1, 1000]`
- `rhs` elements are ordered to match the MATLAB function signature
- `mwdata` is always an array, even for scalars: `[3.14]`
- `mwsize` is `[rows, cols]` — a scalar is `[1, 1]`, a string "Sine" is `[1, 4]`
- Matrices are stored column-major in `mwdata`
- Common `mwtype` values: `"double"`, `"char"`, `"logical"`, `"single"`, `"int32"`, `"struct"`, `"cell"`

## Best Practices

- **One function per computation** — keep MPS functions focused. Multiple functions can go in a single .ctf.
- **Always use Postman or cURL first** — never debug the API through the front end. Isolate the layers.
- **Watch the mwsize field** — a common mistake is wrong sizes, especially for strings. "Sine" has mwsize `[1, 4]`.
- **Keep durations short during testing** — use small inputs while debugging to keep response payloads manageable.
- **Downsample before plotting** — Chart.js degrades above ~5,000 points. Consider decimation in MATLAB or JS.
- **Log the raw response** — always `console.log(result)` during development so you can inspect the full lhs structure.
- **Version your archives** — use `signalApp_v2` during development so you can roll back.
- **Handle errors gracefully** — check `response.ok` before parsing JSON. Show user-friendly errors and log details to console.
- **Static serving is for prototyping** — MPS built-in static file serving is great for dev/test, but use a dedicated web server (Nginx, Apache) for production deployments.
